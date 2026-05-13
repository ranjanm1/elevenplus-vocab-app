export type QuizWord = {
  id: string;
  word: string;
  definition: string;
};

export type AssessmentQuizQuestion = {
  itemId: string;
  wordId: string;
  word: string;
  correctAnswer: string;
  options: string[];
};

export function shuffleArray<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function buildDefinitionMatchQuestions(
  selectedWords: Array<QuizWord & { itemId?: string }>,
  poolWords: QuizWord[]
): AssessmentQuizQuestion[] {
  return selectedWords.map((item) => {
    const distractors = shuffleArray(
      poolWords
        .filter((candidate) => candidate.id !== item.id)
        .map((candidate) => candidate.definition)
        .filter(
          (definition, index, arr) =>
            Boolean(definition) &&
            definition !== item.definition &&
            arr.indexOf(definition) === index
        )
    ).slice(0, 3);

    return {
      itemId: item.itemId || item.id,
      wordId: item.id,
      word: item.word,
      correctAnswer: item.definition,
      options: shuffleArray([item.definition, ...distractors]),
    };
  });
}
