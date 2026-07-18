import React, { useMemo } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import Markdown, { ASTNode } from 'react-native-markdown-display';
import { FuchsiaFonts, FuchsiaColors } from '@/constants/theme';

type Props = {
  children: string;
  style?: TextStyle | TextStyle[];
  boldStyle?: TextStyle;
  italicStyle?: TextStyle;
};

/**
 * Full Markdown renderer supporting bold, italic, lists, and tables.
 */
export function MarkdownText({ children, style, boldStyle, italicStyle }: Props) {
  // Flatten array of styles if passed
  const flatStyle = StyleSheet.flatten(style || {});

  const markdownStyles = useMemo(() => {
    return StyleSheet.create({
      body: {
        fontFamily: FuchsiaFonts.body,
        fontSize: flatStyle.fontSize || 15,
        color: flatStyle.color || '#000',
        lineHeight: flatStyle.lineHeight || 22,
        marginBottom: -10, // Offset the margin of the last paragraph so bubble padding is perfect
      },
      heading1: {
        fontFamily: FuchsiaFonts.heading,
        fontSize: 20,
        color: flatStyle.color || FuchsiaColors.ink,
        marginTop: 12,
        marginBottom: 8,
      },
      heading2: {
        fontFamily: FuchsiaFonts.heading,
        fontSize: 18,
        color: flatStyle.color || FuchsiaColors.ink,
        marginTop: 12,
        marginBottom: 8,
      },
      heading3: {
        fontFamily: FuchsiaFonts.heading,
        fontSize: 16,
        color: flatStyle.color || FuchsiaColors.ink,
        marginTop: 12,
        marginBottom: 8,
      },
      heading4: {
        fontFamily: FuchsiaFonts.heading,
        fontSize: 15,
        color: flatStyle.color || FuchsiaColors.ink,
        marginTop: 12,
        marginBottom: 8,
      },
      heading5: {
        fontFamily: FuchsiaFonts.heading,
        fontSize: 14,
        color: flatStyle.color || FuchsiaColors.ink,
        marginTop: 12,
        marginBottom: 8,
      },
      heading6: {
        fontFamily: FuchsiaFonts.heading,
        fontSize: 14,
        color: flatStyle.color || FuchsiaColors.ink,
        marginTop: 12,
        marginBottom: 8,
      },
      paragraph: {
        marginTop: 0,
        marginBottom: 10,
      },
      bullet_list: {
        marginTop: 0,
        marginBottom: 10,
      },
      ordered_list: {
        marginTop: 0,
        marginBottom: 10,
      },
      hr: {
        marginTop: 0,
        marginBottom: 10,
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.1)',
      },
      strong: {
        fontFamily: FuchsiaFonts.heading,
        fontWeight: 'normal', // Let the custom font handle the weight
        ...(boldStyle || {}),
      },
      em: {
        fontStyle: 'italic',
        ...(italicStyle || {}),
      },
      table: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        borderRadius: 8,
        marginVertical: 12,
      },
      link: {
        color: FuchsiaColors.vibrant,
        textDecorationLine: 'underline',
      },
      tr: {
        borderBottomWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        flexDirection: 'row',
      },
      th: {
        fontFamily: FuchsiaFonts.heading,
        padding: 8,
        flex: 1,
      },
      td: {
        padding: 8,
        flex: 1,
      },
    });
  }, [flatStyle, boldStyle, italicStyle]);

  return (
    <Markdown style={markdownStyles}>
      {children}
    </Markdown>
  );
}
