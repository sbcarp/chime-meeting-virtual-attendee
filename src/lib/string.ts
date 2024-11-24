export function generateRandomSentence(maxSize: number): string {
    if (maxSize <= 0) return "";

    const characters = "abcdefghijklmnopqrstuvwxyz";
    const emojis = ["😊", "🚀", "🍎", "🌍", "🐶", "🏞️", "🎉", "💡", "⚡", "❤️", "🔥", "🐱", "🌟", "🦄", "🍔", "🏖️", "🌈"];

    const randomWord = () => {
        const length = Math.floor(Math.random() * 6) + 2; // Word length between 2 and 7
        return Array.from({ length })
            .map(() => characters[Math.floor(Math.random() * characters.length)])
            .join("");
    };

    const randomEmoji = () => emojis[Math.floor(Math.random() * emojis.length)];

    let sentence = "";
    while (sentence.length < maxSize) {
        const isEmoji = Math.random() < 0.3; // 30% chance to add an emoji
        const nextPart = isEmoji ? randomEmoji() : randomWord();
        const newLength = sentence.length + nextPart.length + 1; // +1 for space

        if (newLength > maxSize) break;

        sentence += (sentence.length > 0 ? " " : "") + nextPart;
    }

    return sentence;
}