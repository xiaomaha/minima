import { Extension } from '@tiptap/core'

export const SafeUndo = Extension.create({
  name: 'focusGuardedHistory',
  addKeyboardShortcuts() {
    return {
      'Mod-z': ({ editor }) => {
        if (!editor.isFocused) return false
        return editor.commands.undo()
      },
      'Mod-y': ({ editor }) => {
        if (!editor.isFocused) return false
        return editor.commands.redo()
      },
      'Mod-Shift-z': ({ editor }) => {
        if (!editor.isFocused) return false
        return editor.commands.redo()
      },
    }
  },
})
