export type RegexJob = { pattern:string; flags:string; input:string; replacement:string }
export type Match = { index:number; text:string; groups:(string|undefined)[]; named?:Record<string,string> }
export type RegexResult = { matches:Match[]; output:string } | { error:string }
self.onmessage = ({data}:MessageEvent<RegexJob>) => {
  try {
    const expression = new RegExp(data.pattern, data.flags)
    const iterator = data.input.matchAll(new RegExp(expression.source,expression.global ? expression.flags : expression.flags+'g'))
    const matches:Match[] = []
    for(const result of iterator) {
      matches.push({index:result.index ?? 0,text:result[0],groups:result.slice(1),named:result.groups})
      if(!expression.global || matches.length >= 200) break
    }
    const output = data.input.replace(expression,data.replacement).slice(0,100_000)
    self.postMessage({matches,output} satisfies RegexResult)
  } catch(error) { self.postMessage({error:error instanceof Error ? error.message : 'Expresión inválida.'} satisfies RegexResult) }
}
