export const COUNTRY: Record<string,[string,string]> = {
 US:['美国','United States of America'],CN:['中国大陆','China'],TW:['中国台湾','Taiwan'],JP:['日本','Japan'],KR:['韩国','South Korea'],
 NL:['荷兰','Netherlands'],DE:['德国','Germany'],FR:['法国','France'],GB:['英国','United Kingdom'],CH:['瑞士','Switzerland'],
 CL:['智利','Chile'],AU:['澳大利亚','Australia'],BE:['比利时','Belgium'],IL:['以色列','Israel'],CA:['加拿大','Canada'],ES:['西班牙','Spain'],IT:['意大利','Italy'],
}
export const cn = (c:string)=>COUNTRY[c]?.[0]??c
