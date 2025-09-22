const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
// 1. 방금 설치한 '번역기' 라이브러리를 불러옵니다.
const iconv = require('iconv-lite');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.post('/execute', (req, res) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ output: '명령어를 입력해주세요.' });
  }

  // 2. exec 함수를 실행할 때, 결과를 '글자'가 아닌 '원본 데이터(buffer)'로 받도록 설정합니다.
  exec(command, { encoding: 'buffer' }, (error, stdout, stderr) => {
    // 3. 원본 데이터를 'CP949(윈도우 한글)' 방식에서 'UTF-8(웹 표준)' 방식으로 번역합니다.
    const decodedStdout = iconv.decode(stdout, 'cp949');
    const decodedStderr = iconv.decode(stderr, 'cp949');

    if (error) {
      console.error(`명령어 실행 실패: ${decodedStderr}`);
      // 번역된 에러 메시지를 보냅니다.
      return res.json({ output: decodedStderr });
    }
    
    // 번역된 성공 메시지를 보냅니다.
    res.json({ output: decodedStdout });
  });
});

app.listen(port, () => {
  console.log(`🚀 서버가 http://localhost:${port} 에서 실행 중입니다.`);
});

