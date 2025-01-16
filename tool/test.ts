import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});



rl.question('あなたの名前は何ですか？', (answer) => {
    console.log(`こんにちは、${answer}さん！`);
    rl.close();
});

