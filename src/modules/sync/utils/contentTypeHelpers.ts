import { ContentTypeElements } from "@kontent-ai/management-sdk";
import {
  DomHtmlNode,
  DomNode,
  nodeParse,
  ParseResult,
  ResolveDomHtmlNodeType,
  ResolveDomTextNodeType,
  transformToJson,
} from "@kontent-ai/rich-text-resolver";

const resolveAssetIdsDomHtmlNode: ResolveDomHtmlNodeType = (node, traverse) => {
  switch (node.tagName) {
    case "figure":
      return node.attributes["data-asset-id"];
    case "a":
      return node.attributes["data-asset-id"];
    default: {
      return node.children.map(traverse);
    }
  }
};

const resolveItemIdsDomHtmlNode: ResolveDomHtmlNodeType = (node, traverse) => {
  switch (node.tagName) {
    case "a":
      return node.attributes["data-item-id"];
    default: {
      return node.children.flatMap(traverse);
    }
  }
};

const customResolveDomTextNode: ResolveDomTextNodeType = () => null;

export const getRequiredIds = (
  elements: ReadonlyArray<ContentTypeElements.Element>,
) => {
  const assetElements = elements.filter((element): element is ContentTypeElements.IAssetElement =>
    element.type === "asset"
  );
  // Use typeguard once types in SDKs are fixed
  const guidelinesElements = elements.filter(element =>
    element.type === "guidelines"
  ) as unknown as ContentTypeElements.IGuidelinesElement[];
  const linkedItemElements = elements.filter((element): element is ContentTypeElements.ILinkedItemsElement =>
    // currently, the subpages type in SDK does not contain default property, therefore subpages are narrowed to ILinkedItemsElement.
    // since the subpages element is the same as the linked items element apart from the type property.
    element.type === "modular_content" || element.type === "subpages"
  );

  const parsedGuidelines = guidelinesElements.map(g => nodeParse(g.guidelines));

  const assetIds = getRequiredItemOrAssetIds(assetElements, parsedGuidelines, resolveAssetIdsDomHtmlNode);
  const itemIds = getRequiredItemOrAssetIds(linkedItemElements, parsedGuidelines, resolveItemIdsDomHtmlNode);

  return { assetIds, itemIds };
};

const getRequiredItemOrAssetIds = (
  elements: ContentTypeElements.ILinkedItemsElement[] | ContentTypeElements.IAssetElement[],
  parsedGuidelines: ParseResult[],
  resolveDomTextNode: (node: DomHtmlNode, traverse: (node: DomNode) => unknown) => unknown,
) => {
  const elementsIds = elements.reduce((previous, e) => {
    e.default?.global.value.forEach(i => {
      previous.add(i.id as string);
    });

    return previous;
  }, new Set<string>());

  const idsFromGuidelines = parsedGuidelines.reduce<string[]>((prev, guideline) =>
    [
      ...prev,
      transformToJson(guideline, {
        resolveDomTextNode: customResolveDomTextNode,
        resolveDomHtmlNode: resolveDomTextNode,
      }),
    ] as string[], []).flat(Infinity).filter(g => g);

  return new Set([...elementsIds, ...idsFromGuidelines]);
};