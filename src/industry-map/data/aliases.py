#!/usr/bin/env python3
"""v1.8 中文公司名匹配：为每家公司生成别名（全称、简称、英文短名、A股/港股代码），写 data/aliases.json。
简称规则：去掉「股份有限公司/集团/控股/科技/股份」等后缀；少于 2 个汉字或在歧义词表中的别名丢弃。
用法: python3 data/aliases.py"""
import json,os,re
HERE=os.path.dirname(os.path.abspath(__file__))
core=json.load(open(os.path.join(HERE,'..','public','data','core.json')))
EXTRA={'sanhua':['三花','三花智控','Sanhua'],'tongwei':['通威','通威股份'],'longi':['隆基','隆基绿能','LONGi'],'sungrow':['阳光电源','Sungrow'],'huawei':['华为','华为技术','Huawei'],
 'catl':['宁德时代','CATL','Contemporary Amperex'],'nio':['蔚来','NIO Inc'],'xpeng':['小鹏汽车','小鹏','XPeng'],'robosense':['速腾聚创','RoboSense'],'wuxibiologics':['药明生物','WuXi Biologics'],
 'novo':['诺和诺德','Novo Nordisk'],'fluence':['Fluence'],'lges':['LG新能源','LG Energy Solution'],'byd':['比亚迪','BYD'],'nvidia':['英伟达','NVIDIA'],'geely':['吉利','吉利汽车','Geely','Zeekr','极氪'],'tesla':['特斯拉','Tesla']}
AMBIG={'理想','现代','长安','中环','大众','光明','联合','科技','电子','能源','新能源','智能','精密','汽车'}
SUF=r'(股份有限公司|有限责任公司|有限公司|集团股份|集团|控股|股份|科技|技术|电子|新能源|智能|智控)$'
out={}
for c in core['companies']:
  a=set(EXTRA.get(c['id'],[]))
  zh=c.get('zh') or ''
  if zh: a.add(zh)
  s=zh
  for _ in range(3): s=re.sub(SUF,'',s)
  if len(s)>=2: a.add(s)
  en=c.get('en') or ''
  if en: a.add(en); a.add(re.sub(r'\s+(Inc\.?|Corp\.?|Corporation|Co\.?,? Ltd\.?|Ltd\.?|Group|Holdings?|Limited|plc|AG|SE|N\.V\.)$','',en))
  for l in c.get('listings') or []:
    t=l.get('ticker','')
    if re.fullmatch(r'\d{6}',t): a.add(t)
    if l.get('exchange')=='HKEX' and t.isdigit(): a.add(t.zfill(5)+'.HK')
  out[c['id']]=sorted(x for x in a if x and x not in AMBIG and (len(x)>=2 if re.search(r'[\u4e00-\u9fff]',x) else len(x)>=3))
json.dump(out,open(os.path.join(HERE,'aliases.json'),'w'),ensure_ascii=False,indent=1)
print(len(out),'companies',sum(map(len,out.values())),'aliases')
