import { ArbitraryNode, Handler, NodeObject, Options, Props } from "./types.ts";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: unknown;
    }
  }
}

export function h(
  tag: string | Handler,
  props: Record<string, unknown>,
  ...children: unknown[]
): NodeObject {
  return {
    tag,
    props: { ...props, children: children.flat() },
  };
}

export const Fragment = "fragment";

const HTML_ENTITIES: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
};

function encode(str: string): string {
  return str.replace(/[<>&"]/g, (char) => HTML_ENTITIES[char]);
}

// TODO: append px to numeric values
function css(obj: Record<string, string>): string {
  return Object.entries(obj).map(([p, v]) => `${kebab(p)}: ${v}`).join("; ");
}

// render HTML attributes
function renderAttrs(props: Props = {}): string {
  return Object.entries(props).map(([key, value]) => {
    switch (key) {
      case "dangerouslySetInnerHTML":
      case "children":
        return "";
      case "style":
        return ` style="${css(value as Record<string, string>)}"`;
      default:
        if (value === true) {
          return ` ${key}`;
        } else {
          return ` ${key}="${String(value).replace('"', "&quot;")}"`;
        }
    }
  }).join("");
}

// convert camelCase to kebab-case
function kebab(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

function selfClosing(tag: string): boolean {
  switch (tag) {
    case "area":
    case "base":
    case "br":
    case "col":
    case "embed":
    case "hr":
    case "img":
    case "input":
    case "link":
    case "meta":
    case "param":
    case "source":
    case "track":
    case "wbr":
      return true;
  }
  return false;
}

function empty(node: ArbitraryNode): boolean {
  switch (node) {
    case undefined:
    case null:
    case true:
    case false:
      return true;
  }
  return false;
}

// Run all (async) functions and return a tree of simple object nodes
async function resolve(node: ArbitraryNode): Promise<ArbitraryNode> {
  if (typeof node?.tag === "function") {
    node = await resolve(await node.tag(node.props));
  }
  if (node.props?.children) {
    node.props.children = await Promise.all(
      node.props.children?.map((child: unknown) => resolve(child)),
    );
  }
  return node;
}

function render(node: unknown, pad = "", options: Options): string {
  if (empty(node)) {
    return "";
  }

  const { maxInlineContentWidth, tab, newline } = options;

  if (typeof node !== "object") {
    return pad + encode(String(node));
  }

  if (selfClosing(node.tag)) {
    return pad + `<${node.tag}${renderAttrs(node.props)} />`;
  }

  // special case to handle <textarea value="foo" />
  if (node.tag === "textarea") {
    const { value, children, ...rest } = node.props;
    // note: we're okay with rendering [object Object] for non-string children
    return pad +
      `<textarea${renderAttrs(rest)}>${value ?? children}</textarea>`;
  }

  let innerHTML = "";

  // draw tag on multiple lines
  let blockFormat = false;

  if (node.props?.dangerouslySetInnerHTML?.__html) {
    blockFormat = true;
    innerHTML = pad + tab + node.props.dangerouslySetInnerHTML?.__html;
  } else {
    const children = node.props?.children ?? [];

    // only text
    if (children.every((child: unknown) => typeof child !== "object")) {
      innerHTML = encode(children.join(""));
      blockFormat = node.tag !== "pre" &&
        innerHTML.length > maxInlineContentWidth;
      if (blockFormat) {
        innerHTML = pad + tab + innerHTML;
      }
    } else {
      blockFormat = node.tag !== "pre";
      const padpad = node.tag !== Fragment && blockFormat ? pad + tab : "";
      innerHTML = children.map((child: unknown) =>
        render(child, padpad, options)
      )
        .join(
          newline,
        );
    }
  }

  if (node.tag === Fragment) {
    return innerHTML;
  }

  if (blockFormat) {
    innerHTML = `${newline}${innerHTML}${newline}${pad}`;
  }

  return pad +
    `<${node.tag}${renderAttrs(node.props)}>${innerHTML}</${node.tag}>`;
}

export async function renderJSX(
  jsx: unknown,
  options: Partial<Options> = {},
): Promise<string> {
  // options with defaults
  const {
    pretty = true,
    maxInlineContentWidth = 40,
    tab = "    ",
    newline = "\n",
  } = options;

  return render(await resolve(jsx), "", {
    maxInlineContentWidth,
    tab: pretty ? tab : "",
    newline: pretty ? newline : "",
  });
}
