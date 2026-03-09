import CommandService from '../../CommandService';
import { setupDatabaseAndSynchronizer, switchClient, createTempDir } from '../../../testing/test-utils';
import JoplinCommands from './JoplinCommands';
import Plugin from '../Plugin';
import stateToWhenClauseContext from '../../commands/stateToWhenClauseContext';
import * as fs from 'fs-extra';
import { join } from 'path';

// Minimal SVG file content for tests
const testSvgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="8"/></svg>';
const testSvgBase64 = Buffer.from(testSvgContent).toString('base64');

function initCommandServiceSingleton(): CommandService {
	const service = CommandService.instance();
	const mockStore = {
		getState: () => ({}),
	};
	service.initialize(mockStore, true, stateToWhenClauseContext);
	return service;
}

function newPlugin(baseDir: string): Plugin {
	const manifest = {
		manifest_version: 1,
		id: 'test.custom.icon.plugin',
		name: 'Test Plugin',
		version: '1.0.0',
		app_min_version: '1.0.0',
		author: 'Test',
		description: 'Test plugin for icon tests',
	};

	return new Plugin(baseDir, manifest, '', () => {}, '/tmp/data');
}

describe('JoplinCommands custom icon', () => {

	beforeEach(async () => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
	});

	it('should convert an SVG icon file to a data URI during registration', async () => {
		const tempDir = await createTempDir();
		const iconPath = join(tempDir, 'icon.svg');
		await fs.writeFile(iconPath, testSvgContent);

		const service = initCommandServiceSingleton();

		const plugin = newPlugin(tempDir);
		const joplinCommands = new JoplinCommands(plugin);

		await joplinCommands.register({
			name: 'testSvgIcon',
			label: 'Test SVG Icon',
			icon: './icon.svg',
			execute: async () => {},
		});

		const command = service.commandByName('testSvgIcon');
		expect(command.declaration.icon).toBe(`data:image/svg+xml;base64,${testSvgBase64}`);
		// iconName should get the default fallback
		expect(command.declaration.iconName).toBe('fas fa-cog');

		await fs.remove(tempDir);
	});

	it('should convert a PNG icon file to a data URI during registration', async () => {
		const tempDir = await createTempDir();
		const iconPath = join(tempDir, 'icon.png');
		// Write a small valid 1x1 PNG
		const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAxJREFUCNdjYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==', 'base64');
		await fs.writeFile(iconPath, pngBuffer);

		const service = initCommandServiceSingleton();

		const plugin = newPlugin(tempDir);
		const joplinCommands = new JoplinCommands(plugin);

		await joplinCommands.register({
			name: 'testPngIcon',
			label: 'Test PNG Icon',
			icon: './icon.png',
			execute: async () => {},
		});

		const command = service.commandByName('testPngIcon');
		expect(command.declaration.icon).toMatch(/^data:image\/png;base64,/);

		await fs.remove(tempDir);
	});

	it('should use iconName when icon is not provided', async () => {
		const tempDir = await createTempDir();

		const service = initCommandServiceSingleton();

		const plugin = newPlugin(tempDir);
		const joplinCommands = new JoplinCommands(plugin);

		await joplinCommands.register({
			name: 'testIconName',
			label: 'Test IconName',
			iconName: 'fas fa-star',
			execute: async () => {},
		});

		const command = service.commandByName('testIconName');
		expect(command.declaration.iconName).toBe('fas fa-star');
		expect(command.declaration.icon).toBeUndefined();

		await fs.remove(tempDir);
	});

	it('should warn and skip when icon file does not exist', async () => {
		const tempDir = await createTempDir();

		const service = initCommandServiceSingleton();

		const plugin = newPlugin(tempDir);
		const joplinCommands = new JoplinCommands(plugin);

		await joplinCommands.register({
			name: 'testMissingIcon',
			label: 'Test Missing Icon',
			icon: './missing-icon.svg',
			execute: async () => {},
		});

		const command = service.commandByName('testMissingIcon');
		// icon should not be set when file is missing
		expect(command.declaration.icon).toBeUndefined();
		// Should still get default iconName
		expect(command.declaration.iconName).toBe('fas fa-cog');

		await fs.remove(tempDir);
	});

	it('should reject unsupported file extensions', async () => {
		const tempDir = await createTempDir();
		const iconPath = join(tempDir, 'icon.txt');
		await fs.writeFile(iconPath, 'not an icon');

		const service = initCommandServiceSingleton();

		const plugin = newPlugin(tempDir);
		const joplinCommands = new JoplinCommands(plugin);

		await joplinCommands.register({
			name: 'testBadExt',
			label: 'Test Bad Extension',
			icon: './icon.txt',
			execute: async () => {},
		});

		const command = service.commandByName('testBadExt');
		expect(command.declaration.icon).toBeUndefined();

		await fs.remove(tempDir);
	});

	it('should reject icon files that are too large', async () => {
		const tempDir = await createTempDir();
		const iconPath = join(tempDir, 'large.svg');
		// Create a file larger than 100KB
		const largeContent = `<svg>${'x'.repeat(101 * 1024)}</svg>`;
		await fs.writeFile(iconPath, largeContent);

		const service = initCommandServiceSingleton();

		const plugin = newPlugin(tempDir);
		const joplinCommands = new JoplinCommands(plugin);

		await joplinCommands.register({
			name: 'testLargeIcon',
			label: 'Test Large Icon',
			icon: './large.svg',
			execute: async () => {},
		});

		const command = service.commandByName('testLargeIcon');
		expect(command.declaration.icon).toBeUndefined();

		await fs.remove(tempDir);
	});

	it('should reject path traversal attempts', async () => {
		const tempDir = await createTempDir();

		const service = initCommandServiceSingleton();

		const plugin = newPlugin(tempDir);
		const joplinCommands = new JoplinCommands(plugin);

		await joplinCommands.register({
			name: 'testTraversal',
			label: 'Test Traversal',
			icon: '../../etc/passwd',
			execute: async () => {},
		});

		const command = service.commandByName('testTraversal');
		// Should not have set an icon (resolveRelativePathWithinDir throws)
		expect(command.declaration.icon).toBeUndefined();

		await fs.remove(tempDir);
	});

	it('should prefer icon over iconName when both provided', async () => {
		const tempDir = await createTempDir();
		const iconPath = join(tempDir, 'icon.svg');
		await fs.writeFile(iconPath, testSvgContent);

		const service = initCommandServiceSingleton();

		const plugin = newPlugin(tempDir);
		const joplinCommands = new JoplinCommands(plugin);

		await joplinCommands.register({
			name: 'testBoth',
			label: 'Test Both',
			iconName: 'fas fa-star',
			icon: './icon.svg',
			execute: async () => {},
		});

		const command = service.commandByName('testBoth');
		// icon should be set (data URI)
		expect(command.declaration.icon).toBe(`data:image/svg+xml;base64,${testSvgBase64}`);
		// iconName should also be set (for fallback)
		expect(command.declaration.iconName).toBe('fas fa-star');

		await fs.remove(tempDir);
	});

	it('should handle subdirectory icon paths', async () => {
		const tempDir = await createTempDir();
		const iconsDir = join(tempDir, 'icons');
		await fs.mkdirp(iconsDir);
		const iconPath = join(iconsDir, 'my-icon.svg');
		await fs.writeFile(iconPath, testSvgContent);

		const service = initCommandServiceSingleton();

		const plugin = newPlugin(tempDir);
		const joplinCommands = new JoplinCommands(plugin);

		await joplinCommands.register({
			name: 'testSubdir',
			label: 'Test Subdirectory',
			icon: './icons/my-icon.svg',
			execute: async () => {},
		});

		const command = service.commandByName('testSubdir');
		expect(command.declaration.icon).toBe(`data:image/svg+xml;base64,${testSvgBase64}`);

		await fs.remove(tempDir);
	});
});
