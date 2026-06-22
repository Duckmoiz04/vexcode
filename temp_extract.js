const mammoth = require('mammoth');
const path = 'C:\\Users\\vietn\\Downloads\\Bản sao của Huong dan trinh bay DATN, 2020.docx';
mammoth.extractRawText({ path })
  .then(r => process.stdout.write(r.value))
  .catch(e => { console.error('ERR', e.message); process.exit(1); });
