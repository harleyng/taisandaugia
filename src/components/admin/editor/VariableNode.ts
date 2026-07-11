import { Node, mergeAttributes } from "@tiptap/react";

// Inline atom node rendered as a styled "chip". Serializes to
// <span data-var="name" data-label="Họ và tên">Họ và tên</span> so it round-trips
// through getHTML()/setContent AND gives the send-time edge function a stable token
// (match by data-var) to replace with the recipient's value.

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    variable: {
      insertVariable: (attrs: { name: string; label: string }) => ReturnType;
    };
  }
}

const CHIP_STYLE =
  "display:inline-block;padding:1px 8px;border-radius:9999px;background:hsl(262 83% 93%);color:hsl(262 60% 45%);font-size:0.92em;font-weight:500;line-height:1.4;";

export const VariableNode = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: {
        default: "name",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-var"),
        renderHTML: (attrs) => ({ "data-var": attrs.name }),
      },
      label: {
        default: "",
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute("data-label") ||
          (el as HTMLElement).textContent ||
          "",
        renderHTML: (attrs) => ({ "data-label": attrs.label }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-var]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "tsdg-var", style: CHIP_STYLE }),
      node.attrs.label || `{{${node.attrs.name}}}`,
    ];
  },

  renderText({ node }) {
    return `{{${node.attrs.name}}}`;
  },

  addCommands() {
    return {
      insertVariable:
        (attrs: { name: string; label: string }) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
