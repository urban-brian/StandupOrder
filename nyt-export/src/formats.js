import readline from 'readline';

const IS_CI = process.env.CI === 'true';

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

function parseFormatString(str) {
  const s = str.toLowerCase();
  const all = s === 'all' || s === '*';
  return {
    json:    all || s.includes('j') || s.includes('json'),
    pdf:     all || s.includes('p') || s.includes('pdf'),
    paprika: all || s.includes('a') || s.includes('paprika'),
  };
}

export async function selectFormats() {
  if (IS_CI) {
    const raw = (process.env.EXPORT_FORMATS || 'json').toLowerCase();
    const formats = parseFormatString(raw);
    const active = Object.entries(formats).filter(([, v]) => v).map(([k]) => k).join(', ');
    console.log(`CI mode — exporting: ${active}\n`);
    return formats;
  }

  const answer = await prompt(
    'Which formats to export? [j]son [p]df [a]paprika  (default: json, e.g. "j p" or "all"): '
  );

  const formats = parseFormatString(answer || 'j');
  const active = Object.entries(formats).filter(([, v]) => v).map(([k]) => k).join(', ');
  console.log(`\nExporting: ${active}\n`);
  return formats;
}
