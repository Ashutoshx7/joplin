import * as React from 'react';
import { ToolbarButtonInfo } from '@joplin/lib/services/commands/ToolbarButtonUtils';
import IconButton from '../IconButton';
import { memo, useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { themeStyle } from '../global-style';
import useButtonSize from './utils/useButtonSize';

interface Props {
	themeId: number;
	extraPadding: number;
	buttonInfo: ToolbarButtonInfo;
	selected?: boolean;
}

const useStyles = (themeId: number, selected: boolean, enabled: boolean, extraPadding: number) => {
	const { buttonSize, iconSize } = useButtonSize();

	return useMemo(() => {
		const theme = themeStyle(themeId);
		return StyleSheet.create({
			icon: {
				color: theme.color,
				fontSize: iconSize,
			},
			button: {
				width: buttonSize + extraPadding,
				height: buttonSize,
				justifyContent: 'center',
				alignItems: 'center',
				backgroundColor: selected ? theme.backgroundColorHover3 : theme.backgroundColor3,
				opacity: enabled ? 1 : theme.disabledOpacity,
			},
		});
	}, [themeId, selected, enabled, buttonSize, iconSize, extraPadding]);
};

const ToolbarButton: React.FC<Props> = memo(({ themeId, buttonInfo, selected, extraPadding }) => {
	const styles = useStyles(themeId, selected, buttonInfo.enabled, extraPadding);
	const isToggleButton = selected !== undefined;

	return <IconButton
		iconName={buttonInfo.iconName}
		description={buttonInfo.title || buttonInfo.tooltip}
		onPress={buttonInfo.onClick}
		disabled={!buttonInfo.enabled}
		iconStyle={styles.icon}
		containerStyle={styles.button}
		accessibilityState={{ selected }}
		accessibilityRole={isToggleButton ? 'togglebutton' : 'button'}
		role={'button'}
		aria-pressed={selected}
		preventKeyboardDismiss={true}
		themeId={themeId}
		// On Android, RN 0.81+ makes Pressable focusable by default, pulling toolbar
		// buttons into the hardware keyboard tab order. Setting focusable to false
		// restores the expected Title → Editor tab flow. See #14548.
		focusable={Platform.OS === 'android' ? false : undefined}
	/>;
});

export default ToolbarButton;
