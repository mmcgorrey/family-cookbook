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

  // Check if input is just a URL
  const trimmed = text.trim();
  const isUrl = /^https?:\/\/\S+$/i.test(trimmed);
  if (isUrl) {
    return res.status(400).json({ 
      error: "URL detected — the parser can't visit websites. Please copy and paste the actual recipe text (ingredients, steps, etc.) from the page instead." 
    });
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

${text}`,
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

    // Try to extract JSON if the model added extra text
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
