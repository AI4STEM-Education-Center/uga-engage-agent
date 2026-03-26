import { describe, expect, it } from "vitest";
import { buildPublishedContentState } from "@/lib/published-content";

describe("buildPublishedContentState", () => {
  it("should merge embedded, published, and direct media using the published content id", () => {
    const state = buildPublishedContentState(
      [
        {
          content_item_id: "item-1",
          content_json: JSON.stringify({
            id: "temporary-id",
            type: "Dialogue",
            title: "Elastic Limit",
            body: "Body",
            strategy: "analogy",
            textModes: ["dialogue", "invalid"],
            visualBrief: "A lab scene",
            media: {
              image: "https://embedded.example.com/image.webp",
            },
          }),
          media: {
            video: "https://published.example.com/video.mp4",
          },
        },
      ],
      [
        {
          content_item_id: "item-1",
          media_type: "image",
          data_url: "https://media.example.com/image.webp",
        },
      ],
    );

    expect(state.contentItems).toEqual([
      {
        id: "item-1",
        type: "Dialogue",
        title: "Elastic Limit",
        body: "Body",
        strategy: "analogy",
        textModes: ["dialogue"],
        visualBrief: "A lab scene",
      },
    ]);
    expect(state.mediaByItemId).toEqual({
      "item-1": {
        image: "https://media.example.com/image.webp",
        video: "https://published.example.com/video.mp4",
      },
    });
  });

  it("should fall back safely when content json is invalid or media is blank", () => {
    const state = buildPublishedContentState(
      [
        {
          content_item_id: "item-2",
          content_json: "{not-json}",
          media: {
            image: "   ",
          },
        },
      ],
      [
        {
          content_item_id: "item-2",
          media_type: "video",
          data_url: "",
        },
      ],
    );

    expect(state.contentItems).toEqual([
      {
        id: "item-2",
        type: "unknown",
        title: "Content",
        body: "",
        strategy: "",
      },
    ]);
    expect(state.mediaByItemId).toEqual({});
  });
});
