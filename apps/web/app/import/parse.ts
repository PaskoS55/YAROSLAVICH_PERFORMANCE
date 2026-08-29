import type { ImportRow } from './actions';
export type ParsedImportRow = ImportRow & { line: number; valid: boolean; problem?: string };
export function parseImport(text: string): ParsedImportRow[] {
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
  const delimiter=(lines.find(line=>line.trim()) ?? '').includes(';') ? ';' : ',';
  return lines.flatMap((line,index)=>{
    if(!line.trim())return [];
    const cells=line.split(delimiter).map(cell=>cell.trim());
    if(cells[0]?.toLowerCase()==='playerid' && cells[1]?.toLowerCase()==='date' && cells[2]?.toLowerCase()==='testcode' && cells[3]?.toLowerCase()==='value')return [];
    const [playerCode='',date='',testCode='',valueText='',phase='']=cells;
    const value=valueText==='' ? NaN : Number(valueText.replace(',','.'));
    const problems=[];
    if(cells.length<4)problems.push('Недостаточно колонок: ожидается минимум 4');
    if(!playerCode || !testCode)problems.push('не указан игрок или тест');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))problems.push('дата (нужен формат ГГГГ-ММ-ДД)');
    if(!Number.isFinite(value))problems.push(valueText==='' ? 'результат не заполнен' : 'значение не число');
    return [{line:index+1,playerCode,date,testCode,value,phase,valid:problems.length===0,problem:problems.join('; ')}];
  });
}
