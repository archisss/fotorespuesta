import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Increase payload limit for high-res camera photos
app.use(express.json({ limit: "25mb" }));

// Lazy-get or instantiate Gemini client
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("ADVERTENCIA: GEMINI_API_KEY no está definida en las variables de entorno.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// API Health Check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "FotoRespuesta API" });
});

// Endpoint to process photo & return answer
app.post("/api/answer-question", async (req, res) => {
  try {
    const { image, openAiApiKey } = req.body;

    if (!image || typeof image !== "string") {
      return res.status(400).json({
        success: false,
        error: "Se requiere una imagen válida en formato Base64 o Data URL.",
      });
    }

    // Parse data URL if provided
    let mimeType = "image/jpeg";
    let base64Data = image;

    if (image.startsWith("data:")) {
      const matches = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      } else {
        base64Data = image.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
      }
    }

    // Option 1: User requested OpenAI API explicitly with custom key
    if (openAiApiKey && openAiApiKey.trim().length > 10) {
      try {
        const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiApiKey.trim()}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "Eres un asistente experto en resolver exámenes y preguntas. Analiza la imagen. Devuelve un objeto JSON con los campos: questionText (string), directAnswer (string enérgico y conciso con la respuesta correcta), options (array de strings opcional), correctOptionIndex (number opcional -1 si no aplica), explanation (string breve), subject (string), confidence ('Alta'|'Media'|'Baja').",
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Obtén ÚNICAMENTE la respuesta correcta a la pregunta de la imagen." },
                  { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
                ],
              },
            ],
          }),
        });

        if (!openAiResponse.ok) {
          const errData = await openAiResponse.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Error de OpenAI status ${openAiResponse.status}`);
        }

        const openAiData = await openAiResponse.json();
        const contentStr = openAiData.choices?.[0]?.message?.content;
        if (!contentStr) throw new Error("Respuesta vacía de OpenAI");

        const parsed = JSON.parse(contentStr);
        return res.json({
          success: true,
          providerUsed: "openai",
          data: {
            questionText: parsed.questionText || "Pregunta detectada en la imagen",
            directAnswer: parsed.directAnswer || "No se pudo determinar la respuesta",
            options: Array.isArray(parsed.options) ? parsed.options : undefined,
            correctOptionIndex: typeof parsed.correctOptionIndex === "number" && parsed.correctOptionIndex >= 0 ? parsed.correctOptionIndex : null,
            explanation: parsed.explanation || "Respuesta generada automáticamente.",
            subject: parsed.subject || "General",
            confidence: parsed.confidence || "Alta",
          },
        });
      } catch (openAiErr: any) {
        console.error("Error en llamada a OpenAI:", openAiErr);
        // Fallback to Gemini if OpenAI custom key failed
      }
    }

    // Default & Preferred: Gemini Vision Server-Side call
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: base64Data,
            },
          },
          {
            text: `Analiza minuciosamente la imagen proporcionada. Contiene una pregunta de examen, cuestionario, libro o pantalla.
Tu tarea primordial es entregar la RESPUESTA CORRECTA exacta, clara y directa.

Sigue estas reglas estrictas:
1. Transcribe la pregunta de la imagen.
2. Identifica la respuesta correcta. Si es de opción múltiple, especifica claramente la opción (ej: "Opción B: 25 km/h") y resáltala. Si es una pregunta de desarrollo o cálculo, da el resultado final exacto.
3. Si hay opciones múltiples en la imagen, extáelas en una lista e indica el índice exacto (0-based) de la opción correcta.
4. Escribe una explicación muy concisa (1 a 3 frases) del razonamiento.
5. Clasifica la asignatura o tema (ej. Matemáticas, Biología, Historia, Física, Inglés, etc.).`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questionText: {
              type: Type.STRING,
              description: "Texto exacto de la pregunta transcrito de la foto",
            },
            directAnswer: {
              type: Type.STRING,
              description: "La respuesta correcta directa y destacada",
            },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Opciones de respuesta si la pregunta es de opción múltiple",
            },
            correctOptionIndex: {
              type: Type.INTEGER,
              description: "Índice 0-based de la opción correcta si aplica, o -1",
            },
            explanation: {
              type: Type.STRING,
              description: "Breve justificación o explicación de la respuesta",
            },
            subject: {
              type: Type.STRING,
              description: "Materia o área temática de la pregunta",
            },
            confidence: {
              type: Type.STRING,
              description: "Nivel de certeza: Alta, Media o Baja",
            },
          },
          required: ["questionText", "directAnswer", "explanation"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No se obtuvo respuesta del modelo de visión IA.");
    }

    const parsedData = JSON.parse(resultText);

    return res.json({
      success: true,
      providerUsed: "gemini",
      data: {
        questionText: parsedData.questionText || "Pregunta en la foto",
        directAnswer: parsedData.directAnswer || "Respuesta procesada",
        options: Array.isArray(parsedData.options) && parsedData.options.length > 0 ? parsedData.options : undefined,
        correctOptionIndex:
          typeof parsedData.correctOptionIndex === "number" && parsedData.correctOptionIndex >= 0
            ? parsedData.correctOptionIndex
            : null,
        explanation: parsedData.explanation || "",
        subject: parsedData.subject || "General",
        confidence: (parsedData.confidence as any) || "Alta",
      },
    });
  } catch (err: any) {
    console.error("Error al procesar la foto de la pregunta:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Ocurrió un error al analizar la imagen. Por favor asegúrate de que la foto sea clara y con buena luz.",
    });
  }
});

async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const isProd = process.env.NODE_ENV === "production" || fs.existsSync(path.join(distPath, "index.html"));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FotoRespuesta servidor listo en puerto ${PORT}`);
  });
}

startServer();
