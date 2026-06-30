import type { editor } from "monaco-editor";

export const editorThemeDark: editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "71717a", fontStyle: "italic" },
    { token: "keyword", foreground: "c084fc" },
    { token: "string", foreground: "34d399" },
    { token: "number", foreground: "fbbf24" },
    { token: "function", foreground: "22d3ee" },
  ],
  colors: {
    "editor.background": "#09090b",
    "editor.foreground": "#e4e4e7",
    "editor.lineHighlightBackground": "#18181b",
    "editor.selectionBackground": "#22d3ee33",
    "editor.inactiveSelectionBackground": "#22d3ee18",
    "editorLineNumber.foreground": "#52525b",
    "editorLineNumber.activeForeground": "#a1a1aa",
    "editorCursor.foreground": "#22d3ee",
    "editorIndentGuide.background": "#27272a",
    "editorIndentGuide.activeBackground": "#3f3f46",
    "editorWidget.background": "#18181b",
    "editorWidget.border": "#ffffff14",
    "minimap.background": "#09090b",
    "scrollbarSlider.background": "#ffffff14",
    "scrollbarSlider.hoverBackground": "#ffffff24",
  },
};

export const editorThemeLight: editor.IStandaloneThemeData = {
  base: "vs",
  inherit: true,
  rules: [
    { token: "comment", foreground: "71717a", fontStyle: "italic" },
    { token: "keyword", foreground: "7c3aed" },
    { token: "string", foreground: "059669" },
    { token: "number", foreground: "d97706" },
    { token: "function", foreground: "0891b2" },
  ],
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#18181b",
    "editor.lineHighlightBackground": "#f4f4f5",
    "editor.selectionBackground": "#06b6d433",
    "editor.inactiveSelectionBackground": "#06b6d418",
    "editorLineNumber.foreground": "#a1a1aa",
    "editorLineNumber.activeForeground": "#52525b",
    "editorCursor.foreground": "#0891b2",
    "editorIndentGuide.background": "#e4e4e7",
    "editorIndentGuide.activeBackground": "#d4d4d8",
    "editorWidget.background": "#ffffff",
    "editorWidget.border": "#00000014",
    "minimap.background": "#ffffff",
    "scrollbarSlider.background": "#00000014",
    "scrollbarSlider.hoverBackground": "#00000024",
    "editorGutter.background": "#fafafa",
  },
};

export function defineEditorTheme(monaco: typeof import("monaco-editor")) {
  monaco.editor.defineTheme("pyorch-dark", editorThemeDark);
  monaco.editor.defineTheme("pyorch-light", editorThemeLight);
}

export function editorThemeName(resolved: "light" | "dark"): "pyorch-light" | "pyorch-dark" {
  return resolved === "light" ? "pyorch-light" : "pyorch-dark";
}
