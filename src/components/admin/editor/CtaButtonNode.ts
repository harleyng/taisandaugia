import { Node, mergeAttributes } from "@tiptap/react";

// Block atom node rendered as a centered, inline-styled CTA button. Inline styles are
// mandatory so email clients (which strip <style>/classes) keep the button look.
// Serializes to <div data-cta-wrap><a data-cta href=… style=…>Label</a></div> and
// round-trips by matching the wrapper.

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ctaButton: {
      insertCtaButton: (attrs: { label: string; href: string }) => ReturnType;
    };
  }
}

const BTN_STYLE =
  "display:inline-block;background:hsl(210 90% 30%);color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;";

const queryAnchor = (el: HTMLElement) => el.querySelector("a");

export const CtaButtonNode = Node.create({
  name: "ctaButton",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      href: {
        default: "#",
        parseHTML: (el) => queryAnchor(el as HTMLElement)?.getAttribute("href") ?? "#",
        renderHTML: () => ({}),
      },
      label: {
        default: "Nút CTA",
        parseHTML: (el) => queryAnchor(el as HTMLElement)?.textContent || "Nút CTA",
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-cta-wrap]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-cta-wrap": "",
        style: "text-align:center;margin:16px 0;",
      }),
      [
        "a",
        {
          "data-cta": "",
          href: node.attrs.href,
          target: "_blank",
          rel: "noreferrer",
          style: BTN_STYLE,
        },
        node.attrs.label,
      ],
    ];
  },

  addCommands() {
    return {
      insertCtaButton:
        (attrs: { label: string; href: string }) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
