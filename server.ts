import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

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

// Helper function to call OpenAI Vision API
async function executeOpenAiVisionRequest(apiKey: string, mimeType: string, base64Data: string) {
  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un experto académico de élite resolviendo exámenes y cuestionarios. Analiza la imagen minuciosamente. Lee la pregunta completa y todas las opciones. Verifica rigurosamente la respuesta antes de seleccionarla. Devuelve un objeto JSON con los campos: questionText (string transcrito exactamente), directAnswer (string claro y directo con la respuesta correcta), options (array de strings con las opciones presentes en la foto), correctOptionIndex (number 0-based de la opción correcta, o -1), explanation (string conciso y riguroso con la justificación), subject (string de la materia), confidence ('Alta'|'Media'|'Baja').",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Obtén la RESPUESTA CORRECTA exacta a la pregunta mostrada en esta imagen." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
          ],
        },
      ],
    }),
  });

  if (!openAiResponse.ok) {
    // If gpt-4o fails or is not accessible, fallback to gpt-4o-mini
    const retryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Eres un experto académico resolviendo exámenes. Analiza la imagen. Devuelve JSON con: questionText, directAnswer, options, correctOptionIndex (0-based o -1), explanation, subject, confidence.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Obtén la respuesta correcta exacta a la pregunta de la imagen." },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
            ],
          },
        ],
      }),
    });
    if (!retryResponse.ok) {
      const errData = await retryResponse.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Error de OpenAI status ${retryResponse.status}`);
    }
    const retryData = await retryResponse.json();
    const contentStr = retryData.choices?.[0]?.message?.content;
    if (!contentStr) throw new Error("Respuesta vacía de OpenAI");
    const parsed = JSON.parse(contentStr);
    return {
      questionText: parsed.questionText || "Pregunta detectada en la imagen",
      directAnswer: parsed.directAnswer || "No se pudo determinar la respuesta",
      options: Array.isArray(parsed.options) ? parsed.options : undefined,
      correctOptionIndex: typeof parsed.correctOptionIndex === "number" && parsed.correctOptionIndex >= 0 ? parsed.correctOptionIndex : null,
      explanation: parsed.explanation || "Respuesta generada automáticamente.",
      subject: parsed.subject || "General",
      confidence: parsed.confidence || "Alta",
    };
  }

  const openAiData = await openAiResponse.json();
  const contentStr = openAiData.choices?.[0]?.message?.content;
  if (!contentStr) throw new Error("Respuesta vacía de OpenAI");

  const parsed = JSON.parse(contentStr);
  return {
    questionText: parsed.questionText || "Pregunta detectada en la imagen",
    directAnswer: parsed.directAnswer || "No se pudo determinar la respuesta",
    options: Array.isArray(parsed.options) ? parsed.options : undefined,
    correctOptionIndex: typeof parsed.correctOptionIndex === "number" && parsed.correctOptionIndex >= 0 ? parsed.correctOptionIndex : null,
    explanation: parsed.explanation || "Respuesta generada automáticamente.",
    subject: parsed.subject || "General",
    confidence: parsed.confidence || "Alta",
  };
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

    const serverOpenAiKey = process.env.OPENAI_API_KEY;
    const effectiveOpenAiKey = (openAiApiKey && openAiApiKey.trim()) || (serverOpenAiKey && serverOpenAiKey.trim());

    // Option 1: User explicitly requested OpenAI API with custom key in request body
    if (openAiApiKey && openAiApiKey.trim().length > 10) {
      try {
        const data = await executeOpenAiVisionRequest(openAiApiKey.trim(), mimeType, base64Data);
        return res.json({
          success: true,
          providerUsed: "openai",
          data,
        });
      } catch (openAiErr: any) {
        console.error("Error en llamada a OpenAI (custom key):", openAiErr);
        // Fallback to Gemini if explicit key failed
      }
    }

    // Option 2 (Primary): Gemini Vision Server-Side call
    const ai = getGeminiClient();
    let response;
    let geminiError: any = null;

    const visionPrompt = `Analiza la imagen adjunta con máxima precisión académica. Contiene una pregunta de examen, cuestionario, libro o pantalla.
Tu objetivo primordial es entregar la RESPUESTA CORRECTA exacta, clara y rigurosa.

Sigue estas instrucciones obligatorias:
1. Transcribe textualmente la pregunta completa que aparece en la imagen.
2. Si hay opciones múltiples en la imagen, transcríbelas todas en el arreglo "options" en su orden exacto.
3. Analiza internamente cada opción y resuelve la pregunta (si es matemática, lógica o conceptual, realiza los cálculos minuciosamente para no fallar).
4. Determina la opción o respuesta correcta. 
   - Si es de opción múltiple, indica en "correctOptionIndex" el índice exacto (0-based) de la opción correcta y en "directAnswer" especifica claramente la respuesta (ej. "Opción B: 25 km/h").
   - Si es de respuesta abierta o cálculo, indica el resultado final exacto en "directAnswer" y pon -1 en "correctOptionIndex".
5. Escribe una explicación concisa y clara (1 a 3 frases) justificando por qué es la respuesta correcta.
6. Especifica la materia o asignatura (ej. Matemáticas, Física, Química, Biología, Historia, Lengua, etc.).
7. Indica tu nivel de certeza: 'Alta', 'Media' o 'Baja'.`;

    const jsonSchema = {
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
    };

    try {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || "image/jpeg",
                  data: base64Data,
                },
              },
              { text: visionPrompt },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: jsonSchema,
          },
        });
      } catch (primaryModelErr: any) {
        console.warn("Reintentando visión con gemini-3.1-pro-preview:", primaryModelErr.message || primaryModelErr);
        response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || "image/jpeg",
                  data: base64Data,
                },
              },
              { text: visionPrompt },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: jsonSchema,
          },
        });
      }

      const resultText = response?.text;
      if (!resultText) {
        throw new Error("No se obtuvo texto de respuesta del modelo de visión Gemini.");
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
      geminiError = err;
      console.warn("Gemini falló (límite de cuota o error). Evaluando respaldo con ChatGPT (OpenAI)... Error:", err.message || err);
    }

    // Option 3: Fallback to ChatGPT (OpenAI API) if Gemini failed and an OpenAI key is set
    if (effectiveOpenAiKey && effectiveOpenAiKey.length > 10) {
      try {
        console.log("Activando respaldo automático con ChatGPT (OpenAI API)...");
        const data = await executeOpenAiVisionRequest(effectiveOpenAiKey, mimeType, base64Data);
        return res.json({
          success: true,
          providerUsed: "openai",
          isFallback: true,
          data,
        });
      } catch (openAiFallbackErr: any) {
        console.error("Error en fallback a OpenAI:", openAiFallbackErr);
      }
    }

    // If both Gemini and OpenAI failed (or no OpenAI key configured)
    throw geminiError || new Error("Error al procesar la imagen con las IA disponibles.");
  } catch (err: any) {
    console.error("Error final al procesar la foto de la pregunta:", err);
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
    const { createServer: createViteServer } = await import("vite");
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
