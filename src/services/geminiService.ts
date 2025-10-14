import { GoogleGenAI, Modality, Type } from "@google/genai";
import { BoundingBox, DetectedPerson, Language } from '../types';

// FIX: Per coding guidelines, API key must be obtained from VITE_ prefixed env var for client-side code.
if (!import.meta.env.VITE_API_KEY) {
  // Log an error to the console for developers but do not throw a hard error that crashes the app.
  console.error("VITE_API_KEY environment variable is not set. The application will not function correctly without it.");
}

// Initialize with the key or an empty string to prevent the app from crashing.
// The functions that use `ai` will check for the key's availability.
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY || "" });

/**
 * Checks if the API key is provided in the environment variables.
 * @returns {boolean} True if the API key is available, false otherwise.
 */
export const isApiKeyAvailable = (): boolean => {
    // FIX: Check import.meta.env.VITE_API_KEY as per Vite guidelines.
    return !!import.meta.env.VITE_API_KEY;
};

/**
 * Parses a caught error to determine a user-friendly error message key.
 * @param e The error object.
 * @returns A string key for the localization files.
 */
const parseGeminiError = (e: unknown): string => {
  if (e instanceof Error) {
    // Handle specific keys we throw internally first
    const internalKeys = ['errorApiKeyMissing', 'errorSafetyBlock', 'errorGenerationNoImage'];
    if (internalKeys.includes(e.message)) {
      return e.message;
    }

    try {
      // API errors often have a message that is a JSON string.
      // We parse it to get detailed error info.
      let errorBody;
      const message = e.message.trim();
      if (message.startsWith('[')) {
        errorBody = JSON.parse(message)[0];
      } else if (message.startsWith('{')) {
        errorBody = JSON.parse(message);
      }

      if (errorBody && errorBody.error) {
        const { status, message: apiMessage } = errorBody.error;
        if (status === 'RESOURCE_EXHAUSTED' || (apiMessage && apiMessage.includes('quota'))) {
          return 'errorQuotaExceeded';
        }
        if (apiMessage && apiMessage.includes('API key not valid')) {
          return 'errorInvalidApiKey';
        }
      }
    } catch (parseError) {
      // Not a JSON message, fall through to simple string checks
    }

    // Simple string checks for non-JSON messages
    if (e.message.includes('API key not valid')) {
      return 'errorInvalidApiKey';
    }
  }

  // Fallback for unknown errors
  console.error("Unknown API Error:", e);
  return 'errorGenericApi';
};


const getMimeType = (base64: string) => {
    return base64.substring(base64.indexOf(":") + 1, base64.indexOf(";"));
}

export const detectPeopleInImage = async (imageBase64: string, model: string): Promise<DetectedPerson[]> => {
    if (!isApiKeyAvailable()) throw new Error("errorApiKeyMissing");
    
    try {
        const imagePart = {
            inlineData: {
                mimeType: getMimeType(imageBase64),
                data: imageBase64.split(',')[1],
            },
        };

        const prompt = "Analyze the provided image and identify all individuals. For each person found, provide their bounding box coordinates (x, y, width, height) normalized to the range [0, 1]. Also assign a unique ID like 'Person 1', 'Person 2', etc. Return this information in a JSON object.";

        const response = await ai.models.generateContent({
            model,
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        people: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    box: {
                                        type: Type.OBJECT,
                                        properties: {
                                            x: { type: Type.NUMBER },
                                            y: { type: Type.NUMBER },
                                            width: { type: Type.NUMBER },
                                            height: { type: Type.NUMBER },
                                        },
                                        required: ["x", "y", "width", "height"],
                                    }
                                },
                                required: ["id", "box"],
                            }
                        }
                    },
                    required: ["people"],
                }
            }
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        if (result.people && Array.isArray(result.people)) {
            return result.people;
        }
        return [];
    } catch (e) {
        console.error("Failed during person detection API call:", e);
        throw new Error(parseGeminiError(e));
    }
};

const promptTemplates = {
  ko: `
    Target Image에서 Target Person Area에 해당하는 인물이 현재 입고 있는 의류를 제거하고, Source Image의 Source Garment Area에 있는 옷을 해당 인물에게 자연스럽게 합성해 주세요.
    
    1. **질감 및 디테일 유지 (Texture and Detail Preservation):** 합성된 옷은 소스 옷의 모든 주름, 질감, 패턴, 색상을 원본 그대로 유지해야 합니다. 옷을 임의로 보정하거나 깨끗하게 만들지 마세요.
    2. **현실적 변형 (Realistic Warping):** 합성 시 Target Person의 몸 형태와 자세에 맞게 옷의 형태를 현실적으로 변형(Warping)해야 합니다.
    3. **광원 및 그림자 (Lighting and Shadows):** 합성 결과가 이질감 없이 보이도록 Target Image의 주변 환경 광원과 그림자 효과를 완벽하게 반영하여 최종 이미지를 생성합니다.
    4. **비율 유지 (Aspect Ratio Preservation):** 최종 결과 이미지는 원본 Target Image와 동일한 가로세로 비율을 유지해야 합니다. 이미지를 자르거나 비율을 변경하지 마세요.
    5. **출력 형식 (Output Format):** 최종 결과물은 텍스트, 마크다운 또는 다른 설명 없이 오직 편집된 이미지 파일 하나여야 합니다.
  `,
  en: `
    Remove the current clothing from the person in the Target Person Area of the Target Image, and naturally synthesize the clothing from the Source Garment Area of the Source Image onto that person.
    
    1. **Texture and Detail Preservation:** The synthesized clothing must maintain all the wrinkles, texture, patterns, and colors of the source garment exactly as they are in the original. Do not arbitrarily correct or clean up the clothing.
    2. **Realistic Warping:** The shape of the clothing must be realistically warped to fit the body shape and posture of the Target Person.
    3. **Lighting and Shadows:** Perfectly reflect the ambient lighting and shadow effects of the Target Image's environment to create a final image that looks natural and seamless.
    4. **Aspect Ratio Preservation:** The final output image must have the exact same aspect ratio as the original Target Image. Do not crop or alter the aspect ratio of the image.
    5. **Output Format:** The final output must be a single, edited image file with no surrounding text, markdown, or explanations.
  `
};


const buildVirtualTryOnPrompt = (targetPersonBox: BoundingBox, sourceGarmentBox: BoundingBox, isSameImage: boolean, language: Language) => {
  const imageLabels = isSameImage 
    ? "The single provided image is both the TARGET and SOURCE IMAGE."
    : "The FIRST image provided is the TARGET IMAGE. The SECOND image is the SOURCE IMAGE.";
  
  const coreInstruction = promptTemplates[language];

  return `
    ${imageLabels}

    In the TARGET IMAGE, locate the person within the bounding box [${targetPersonBox.x.toFixed(4)}, ${targetPersonBox.y.toFixed(4)}, ${targetPersonBox.width.toFixed(4)}, ${targetPersonBox.height.toFixed(4)}].
    In the SOURCE IMAGE, locate the garment within the bounding box [${sourceGarmentBox.x.toFixed(4)}, ${sourceGarmentBox.y.toFixed(4)}, ${sourceGarmentBox.width.toFixed(4)}, ${sourceGarmentBox.height.toFixed(4)}].

    Your task is to perform a virtual try-on with the following instructions:
    ${coreInstruction}
    
    Return ONLY the final, edited image. Do not return any text.
    `;
};

export const generateVirtualTryOnImage = async (
  targetImageBase64: string,
  targetPersonBox: BoundingBox,
  sourceImageBase64: string,
  sourceGarmentBox: BoundingBox,
  language: Language,
  model: string
): Promise<string> => {
  if (!isApiKeyAvailable()) throw new Error("errorApiKeyMissing");
  
  try {
      const isSameImage = targetImageBase64 === sourceImageBase64;
      const prompt = buildVirtualTryOnPrompt(targetPersonBox, sourceGarmentBox, isSameImage, language);

      const targetImagePart = {
        inlineData: {
          mimeType: getMimeType(targetImageBase64),
          data: targetImageBase64.split(',')[1],
        },
      };
      
      const sourceImagePart = {
        inlineData: {
          mimeType: getMimeType(sourceImageBase64),
          data: sourceImageBase64.split(',')[1],
        },
      };

      const parts = isSameImage 
        ? [targetImagePart, { text: prompt }]
        : [targetImagePart, sourceImagePart, { text: prompt }];

      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      const imagePart = response.candidates?.[0]?.content?.parts.find(
        (part) => part.inlineData
      );

      if (imagePart && imagePart.inlineData) {
        const base64ImageBytes = imagePart.inlineData.data;
        const mimeType = imagePart.inlineData.mimeType;
        return `data:${mimeType};base64,${base64ImageBytes}`;
      } else {
        const blockReason = response.candidates?.[0]?.finishReason;
        if (blockReason === 'SAFETY') {
            throw new Error('errorSafetyBlock');
        }
        
        console.error("Full Gemini Response for debugging:", JSON.stringify(response, null, 2));
        throw new Error('errorGenerationNoImage');
      }
    } catch(e) {
        console.error("Failed during image generation API call:", e);
        throw new Error(parseGeminiError(e));
    }
};