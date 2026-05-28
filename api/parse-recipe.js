export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "No recipe text provided" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  let contentToParse = text.trim();

  // If input looks like a URL, fetch the page first
  const isUrl = /^https?:\/\/\S+$/i.test(contentToParse);
  if (isUrl) {
    try {
      const pageResponse = await fetch(contentToParse, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RecipeParser/1.0)",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      if (!pageResponse.ok) {
        return res.status(400).json({ error: "Could not fetch that URL. Try copying and pasting the recipe text instead." });
      }
      const html = await pageResponse.text();
      // Strip HTML tags and collapse whitespace
      contentToParse = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#\d+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      // Limit to first 8000 chars to avoid token limits
      if (contentToParse.length > 8000) {
        contentToParse = contentToParse.substring(0, 8000);
      }
    } catch (e) {
      return res.status(400).json({ error: "Failed to fetch URL: " + e.message + ". Try pasting the recipe text instead." });
    }
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: "You are a recipe JSON parser. You ONLY output valid JSON arrays. Never output explanations, apologies, or any text outside of JSON. If you cannot parse the input, return: [{\"title\":\"Unknown Recipe\",\"description\":\"Could not parse\",\"mealType\":\"Main\",\"servings\":4,\"prepTime\":\"\",\"cookTime\":\"\",\"tags\":[],\"ingredients\":[],\"steps\":[],\"sides\":[],\"drinks\":[]}]",
        messages: [
          {
            role: "user",
            content: `Parse this into a JSON array of recipe objects. If there are MULTIPLE distinct dishes (a main + sides + sauces), create SEPARATE objects for each.

Each object needs: title, description, mealType ("Main"/"Side"/"Appetizer"/"Dessert"/"Drink"), servings (number), prepTime, cookTime, tags (from: Beef, Chicken, Pork, Seafood, Vegetarian, Proteins, Greens, Grains, Italian, Mexican, Asian, Grilling, Smoking, Quick Weeknight, Weekend Project, Date Night, Comfort Food, Healthy, Soup/Stew, Breakfast, Dessert, Appetizer, Brisket BBQ), ingredients (array of {name, amount, unit}), steps (string array), sides (suggestions if main), drinks (pairing suggestions).

Output ONLY the JSON array, nothing else:

${contentToParse}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return res.status(500).json({ error: "Anthropic API returned an error: " + response.status });
    }

    const data = await response.json();
    const raw = data.content?.map((c) => c.text || "").join("") || "";
    const clean = raw.replace(/```json|```/g, "").trim();

    if (!clean) {
      return res.status(500).json({ error: "Empty response from API" });
    }

    let jsonStr = clean;
    const bracketStart = clean.indexOf("[");
    const bracketEnd = clean.lastIndexOf("]");
    if (bracketStart !== -1 && bracketEnd !== -1 && bracketStart < bracketEnd) {
      jsonStr = clean.substring(bracketStart, bracketEnd + 1);
    }

    const parsed = JSON.parse(jsonStr);
    const recipes = Array.isArray(parsed) ? parsed : [parsed];
    return res.status(200).json(recipes);
  } catch (e) {
    console.error("Parse error:", e);
    return res.status(500).json({ error: "Failed to parse recipe: " + e.message });
  }
}
