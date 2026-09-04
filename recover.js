const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\abdul\\.gemini\\antigravity-ide\\brain\\68e5e569-8cb8-4fbd-8343-1d3210230acc\\.system_generated\\logs\\transcript_full.jsonl', 'utf8').split('\n');
let best = '';
for(let line of lines) {
  if(!line) continue;
  try {
    const j = JSON.parse(line);
    if(j.type === 'PLANNER_RESPONSE' && j.tool_calls) {
      for (let call of j.tool_calls) {
        if(call.args && call.args.TargetFile && call.args.TargetFile.includes('globals.css')) {
          if (call.name === 'write_to_file') best = call.args.CodeContent;
          if (call.name === 'replace_file_content') {
            best += '\n/* REPLACE CALL */\n' + call.args.ReplacementContent;
          }
          if (call.name === 'multi_replace_file_content') {
            best += '\n/* MULTI REPLACE CALL */\n' + JSON.stringify(call.args.ReplacementChunks, null, 2);
          }
        }
      }
    }
  } catch(e){}
}
fs.writeFileSync('temp_recovery.css', best || 'Could not find CSS');
