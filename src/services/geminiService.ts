// Fix: Create the geminiService module with exports to resolve import errors.
// This file implements the core logic for interacting with the Google Gemini API.

import { GoogleGenAI, Modality, Type } from '@google/genai';
import { BoundingBox, DetectedPerson } from '../types';

/**
 * Checks if the Gemini API key is available in the environment.
 * Per coding guidelines, this must use process.env.API_KEY. In a Vite/frontend
 * environment, this variable must be injected via the build process.
 * We use @ts-ignore to suppress TypeScript errors as `process` is not standard
 * in browser environments.
 */
export const isApiKeyAvailable = (): boolean => {
  // @ts-ignore
  return !!process.env.API_KEY;
};

/**
 * Initializes and returns a GoogleGenAI instance.
 * Throws an error if the API key is missing.
 */
const getAi = () => {
  // @ts-ignore
  if (!process.env.API_KEY) {
    // This error message key will be used by the UI to show a localized message.
    throw new Error('apiKeyMissing');
  }
  // @ts-ignore
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Converts a base64 data URL to a Gemini Part object.
 * @param base64 The base64 data URL (e.g., "data:image/png;base64,...").
 * @returns A Gemini Part object.
 */
const base64ToGeminiPart = (base64: string) => {
    const match = base64.match(/^data:(image\/(?:png|jpeg|webp));base64,(.*)$/);
    if (!match) {
        console.error('Invalid base64 image format provided to geminiService.');
        throw new Error('imageProcessingError');
    }
    return {
        inlineData: {
            mimeType: match[1],
            data: match[2],
        },
    };
};

/**
 * Detects people in an image using the Gemini API.
 * @param imageBase64 The base64 encoded image.
 * @param modelName The name of the detection model to use.
 * @returns A promise that resolves to an array of detected people.
 */
export const detectPeopleInImage = async (
    imageBase64: string,
    modelName: string
): Promise<DetectedPerson[]> => {
    const ai = getAi();
    const imagePart = base64ToGeminiPart(imageBase64);

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            people: {
                type: Type.ARRAY,
                description: 'An array of all people found in the image.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { 
                            type: Type.STRING,
                            description: 'A unique identifier for the person, e.g., "Person 1".'
                        },
                        box: {
                            type: Type.OBJECT,
                            description: 'The bounding box for the person, with normalized coordinates.',
                            properties: {
                                x: { type: Type.NUMBER, description: "Top-left corner's X coordinate (0-1)." },
                                y: { type: Type.NUMBER, description: "Top-left corner's Y coordinate (0-1)." },
                                width: { type: Type.NUMBER, description: "Box width (0-1)." },
                                height: { type: Type.NUMBER, description: "Box height (0-1)." },
                            },
                            required: ['x', 'y', 'width', 'height'],
                        },
                    },
                    required: ['id', 'box'],
                },
            },
        },
        required: ['people'],
    };

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    imagePart,
                    { text: 'Detect all people in this image. For each person, assign a unique ID like "Person 1", "Person 2", etc., and provide their bounding box coordinates (x, y, width, height) as normalized values between 0 and 1.' }
                ],
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema,
            },
        });

        const text = response.text.trim();
        const json = JSON.parse(text);

        if (!json.people || !Array.isArray(json.people)) {
            return [];
        }

        return json.people.filter((p: any): p is DetectedPerson =>
            p && typeof p.id === 'string' &&
            p.box && typeof p.box.x === 'number' &&
            typeof p.box.y === 'number' &&
            typeof p.box.width === 'number' &&
            typeof p.box.height === 'number'
        );

    } catch (e) {
        console.error('Error detecting people:', e);
        if (e instanceof Error && (e.message.includes('429') || e.message.includes('quota'))) {
             throw new Error('apiQuotaExceededError');
        }
        throw new Error('detectionFailedError');
    }
};

/**
 * Generates a virtual try-on image using the Gemini API.
 * @param targetImageBase64 Base64 of the image with the person.
 * @param personBox Bounding box of the person in the target image.
 * @param sourceImageBase64 Base64 of the image with the garment.
 * @param garmentBox Bounding box of the garment in the source image.
 * @param language The language for the prompt.
 * @param modelName The name of the generation model to use.
 * @returns A promise that resolves to the base64 data URL of the generated image.
 */
export const generateVirtualTryOnImage = async (
    targetImageBase64: string,
    personBox: BoundingBox,
    sourceImageBase64: string,
    garmentBox: BoundingBox,
    language: 'ko' | 'en',
    modelName: string
): Promise<string> => {
    const ai = getAi();

    const targetImagePart = base64ToGeminiPart(targetImageBase64);
    const sourceImagePart = base64ToGeminiPart(sourceImageBase64);
    
    const personBoxStr = `(x: ${personBox.x.toFixed(3)}, y: ${personBox.y.toFixed(3)}, width: ${personBox.width.toFixed(3)}, height: ${personBox.height.toFixed(3)})`;
    const garmentBoxStr = `(x: ${garmentBox.x.toFixed(3)}, y: ${garmentBox.y.toFixed(3)}, width: ${garmentBox.width.toFixed(3)}, height: ${garmentBox.height.toFixed(3)})`;

    const prompt = language === 'ko' ?
        `가상 피팅을 수행해 주세요.
- 첫 번째(타겟) 이미지에서 이 경계 상자 ${personBoxStr} 안에 있는 사람을 찾습니다.
- 두 번째(소스) 이미지에서 이 경계 상자 ${garmentBoxStr} 안에 있는 의류를 찾습니다.
- 소스 이미지의 의류를 타겟 이미지의 사람에게 입혀주세요.
- 결과 이미지는 조명, 그림자, 옷주름 등이 자연스럽게 표현되어야 합니다.
- 타겟 이미지의 배경과 사람의 포즈는 그대로 유지해주세요. 결과물은 반드시 이미지여야 합니다.`
        :
        `Perform a virtual try-on.
- Find the person in the first (target) image within this bounding box: ${personBoxStr}.
- Find the garment in the second (source) image within this bounding box: ${garmentBoxStr}.
- Place the garment from the source image onto the person in the target image.
- The resulting image must be highly realistic, with natural lighting, shadows, and clothing folds.
- Preserve the background and the person's pose from the target image. The output must be an image.`;

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    targetImagePart,
                    sourceImagePart,
                    { text: prompt },
                ]
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                const mimeType = part.inlineData.mimeType;
                return `data:${mimeType};base64,${base64ImageBytes}`;
            }
        }
        
        throw new Error('generationFailedNoImage');

    } catch (e) {
        console.error('Error generating virtual try-on image:', e);
        if (e instanceof Error && (e.message.includes('429') || e.message.includes('quota'))) {
             throw new Error('apiQuotaExceededError');
        }
        throw new Error('generationFailedError');
    }
};
