export enum AppState {
  IDLE,
  ANALYZING_TARGET_IMAGE,
  TARGET_PERSON_CHOOSING,
  TARGET_PERSON_SELECTED,
  SOURCE_TYPE_CHOSEN,
  SOURCE_IMAGE_UPLOADED,
  GARMENT_SELECTED,
  GENERATING,
  RESULT_READY,
  ERROR,
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedPerson {
  id: string;
  box: BoundingBox;
}

export interface HistoryItem {
  id: string;
  generatedImage: string;
}

export type Language = 'ko' | 'en';