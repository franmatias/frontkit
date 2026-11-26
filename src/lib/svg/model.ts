export type SvgSource={ name:string; text:string }
export type SvgOptions={
  removeMetadata:boolean; removeComments:boolean; removeEditors:boolean; removeTitle:boolean; removeDesc:boolean;
  cleanupIds:boolean; prefix:boolean; precision:number; multipass:boolean; removeDimensions:boolean;
  changes:Record<string,string>; currentColor:boolean;
}
export const defaultSvgOptions=():SvgOptions=>({removeMetadata:true,removeComments:true,removeEditors:true,removeTitle:false,removeDesc:false,cleanupIds:true,prefix:false,precision:3,multipass:true,removeDimensions:false,changes:{},currentColor:false})
export type Icon={id:string;name:string;svg:string;symbol:string}
export type SvgEntry={name:string;svg:string;before:number;original:string;colors:Record<string,number>;viewBox:string;derived:boolean}
export type SvgRequest={kind:'optimize'|'sprite'; sources:SvgSource[]; options:SvgOptions; recolor?:string[]}
export type VectorSource={ svg:string; raster:string; width:number; height:number }
export type VectorRequest={kind:'vector'; source:string}
export type VectorResult={ok:true; vector:VectorSource} | {ok:false;error:string}
export type SvgResult={entries:SvgEntry[]; icons:Icon[]; warnings:string[]}
const token=(name:string)=>name.replace(/\.[^.]+$/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
export const iconName=(name:string)=>{
  const id=token(name)
  return !id?'icono':/^[a-z]/.test(id)?id:'icon-'+id
}
export const componentName=(name:string)=>iconName(name).split('-').map(s=>s[0]?.toUpperCase()+s.slice(1)).join('')
export const isPaint=(value:string)=>/^(?:#[\da-f]{3,8}|[a-z]{3,32}|(?:rgba?|hsla?)\([\d.,%\s+-]+\))$/i.test(value)&&!['none','inherit','currentcolor','transparent','initial','unset','revert','context-fill','context-stroke'].includes(value.toLowerCase())
export const example='<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">\n  <title>Brújula</title>\n  <desc>Rosa de los vientos sobre un círculo</desc>\n  <circle cx="60" cy="60" r="52" fill="#1c6955"/>\n  <path d="M60 17 70 51 103 60 70 69 60 103 50 69 17 60 50 51Z" fill="#f3ca66"/>\n</svg>'
export const secondaryExample='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><title>Hoja</title><path fill="#1a7763" d="M5 26C1 11 12 2 30 3 29 20 20 30 5 26Z"/><path fill="none" stroke="#fff" d="M5 26 24 8"/></svg>'
