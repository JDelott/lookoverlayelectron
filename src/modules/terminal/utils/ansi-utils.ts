export class AnsiProcessor {
  static toHtml(text: string): string {
    const ansiRegex = /\x1b\[[0-9;]*m/g;
    const ansiMap: { [key: string]: string } = {
      '\x1b[0m': '</span>',
      '\x1b[1m': '<span class="bold">',
      '\x1b[90m': '<span class="dim">',
      '\x1b[91m': '<span class="red">',
      '\x1b[92m': '<span class="green">',
      '\x1b[93m': '<span class="yellow">',
      '\x1b[94m': '<span class="blue">',
      '\x1b[95m': '<span class="magenta">',
      '\x1b[96m': '<span class="cyan">',
      '\x1b[97m': '<span class="white">',
      '\x1b[31m': '<span class="red">',
      '\x1b[32m': '<span class="green">',
      '\x1b[33m': '<span class="yellow">',
      '\x1b[34m': '<span class="blue">',
      '\x1b[35m': '<span class="magenta">',
      '\x1b[36m': '<span class="cyan">',
      '\x1b[37m': '<span class="white">',
      '\x1b[1;37m': '<span class="bold white">',
      '\x1b[1;32m': '<span class="bold green">',
      '\x1b[1;34m': '<span class="bold blue">',
    };

    return text.replace(ansiRegex, (match) => ansiMap[match] || '');
  }

  static cleanInteractiveOutput(data: string): string {
    return data
      .replace(/\x1b\[[0-9;]*m/g, '')     // Remove color codes (including the 'm')
      .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '') // Remove all other ANSI sequences
      .replace(/\r/g, '\n')               // Convert carriage returns to newlines
      .replace(/\?m/g, '?')               // Clean up question mark remnants
      .replace(/m\?/g, '?')               // Clean up question mark remnants
      .replace(/m([A-Za-z])/g, '$1')      // Remove standalone 'm' before letters
      .replace(/([A-Za-z])m/g, '$1')      // Remove standalone 'm' after letters
      .replace(/\s+m\s+/g, ' ')           // Remove standalone 'm' between spaces
      .replace(/^m|m$/g, '');             // Remove 'm' at start or end of lines
  }
}
