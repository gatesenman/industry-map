"""种子名录：产业/二级分类/环节骨架 + 公司身份（名称、国家、交易所、代码）。
属性数据（ISIN/LEI/官网/产品/营收/市值/股权关系等）一律由 refresh.py 从公开 API 拉取并附来源。"""
import os
_src=open(os.path.join(os.path.dirname(__file__),'gen.py'),encoding='utf-8').read().split('segs=[')[0]
exec(_src)
IND["ce"]=("消费电子","Consumer Electronics")
SEG += [
 ("ce","显示与光学","上游","display","显示面板"),
 ("ce","显示与光学","上游","camera","摄像头与图像传感器"),
 ("ce","元器件与结构件","上游","passive","被动元件"),
 ("ce","元器件与结构件","上游","precision","精密结构件/声学/模组"),
 ("ce","核心芯片","中游","cechip","处理器/SoC"),
 ("ce","组装制造","中游","assembly","整机组装代工"),
 ("ce","终端品牌","下游","phone","手机/PC 品牌"),
 ("ce","渠道","下游","retail","零售渠道"),
]
LINKS["ce"]=[("display","assembly"),("camera","assembly"),("passive","assembly"),("precision","assembly"),("cechip","assembly"),("assembly","phone"),("phone","retail")]
C += [
("marvell","迈威尔科技","Marvell Technology","US","Nasdaq","MRVL",["soc"],"数据中心定制芯片、网络芯片"),
("renesas","瑞萨电子","Renesas Electronics","JP","TSE","6723",["analog"],"汽车 MCU、SoC"),
("microchip","微芯科技","Microchip Technology","US","Nasdaq","MCHP",["analog"],"MCU、模拟芯片"),
("adi","亚德诺","Analog Devices","US","Nasdaq","ADI",["analog"],"数据转换器、模拟芯片"),
("kioxia","铠侠","Kioxia Holdings","JP","TSE","285A",["memory"],"NAND 闪存"),
("omnivision","豪威集团","OmniVision (Will Semiconductor)","CN","SSE","603501",["soc","camera"],"CMOS 图像传感器"),
("cambricon","寒武纪","Cambricon Technologies","CN","SSE STAR","688256",["compute"],"AI 芯片"),
("hygon","海光信息","Hygon Information Technology","CN","SSE STAR","688041",["compute"],"x86 服务器 CPU、DCU"),
("teradyne","泰瑞达","Teradyne","US","Nasdaq","TER",["metro"],"半导体测试设备"),
("asmi","ASM 国际","ASM International","NL","Euronext Amsterdam","ASM",["etchdep"],"ALD/外延设备"),
("entegris","英特格","Entegris","US","Nasdaq","ENTG",["resist","gas"],"特种化学品、过滤与材料"),
("huayou","华友钴业","Zhejiang Huayou Cobalt","CN","SSE","603799",["cathode","lithium"],"钴/镍/锂产品、前驱体"),
("eve","亿纬锂能","EVE Energy","CN","SZSE","300014",["battery","storage"],"动力电池、储能电池"),
("sunwoda","欣旺达","Sunwoda Electronic","CN","SZSE","300207",["battery"],"动力电池、消费电池"),
("dynanonic","德方纳米","Shenzhen Dynanonic","CN","SZSE","300769",["cathode"],"磷酸铁锂正极"),
("senior","星源材质","Shenzhen Senior Technology Material","CN","SZSE","300568",["separator"],"锂电隔膜"),
("capchem","新宙邦","Shenzhen Capchem","CN","SZSE","300037",["electrolyte"],"电解液"),
("tuopu","拓普集团","Ningbo Tuopu Group","CN","SSE","601689",["thermal"],"热管理系统、底盘件"),
("valeo","法雷奥","Valeo","FR","Euronext Paris","FR",["thermal","edrive"],"热管理、电驱系统"),
("leapmotor","零跑汽车","Leapmotor","CN","HKEX","9863",["oem"],"智能电动车"),
("gwm","长城汽车","Great Wall Motor","CN","SSE/HKEX","601633 / 2333",["oem"],"新能源整车"),
("gac","广汽集团","GAC Group","CN","SSE/HKEX","601238 / 2238",["oem"],"埃安等新能源整车"),
("saic","上汽集团","SAIC Motor","CN","SSE","600104",["oem"],"新能源整车"),
("lucid","Lucid","Lucid Group","US","Nasdaq","LCID",["oem"],"Air 系列电动车"),
("polestar","极星","Polestar Automotive","SE","Nasdaq","PSNY",["oem"],"电动车"),
("blacksesame","黑芝麻智能","Black Sesame Technologies","CN","HKEX","2533",["adchip"],"智驾芯片"),
("robosense","速腾聚创","RoboSense","CN","HKEX","2498",["lidar"],"激光雷达"),
("shangji","上机数控","Wuxi Shangji Automation","CN","SSE","603185",["ingot"],"单晶硅片"),
("shuangliang","双良节能","Shuangliang Eco-Energy","CN","SSE","600481",["ingot","equip"],"单晶硅片、还原炉"),
("hiuv","海优新材","Shanghai HIUV New Materials","CN","SSE STAR","688680",["film"],"光伏胶膜"),
("fusion","聚和材料","Changzhou Fusion New Material","CN","SSE STAR","688503",["paste"],"光伏银浆"),
("laplace","拉普拉斯","Laplace Renewable Energy","CN","SSE STAR","688726",["equip"],"电池片热制程设备"),
("autowell","奥特维","Wuxi Autowell","CN","SSE STAR","688516",["equip"],"串焊机"),
("dmegc","横店东磁","DMEGC","CN","SZSE","002056",["cell","module"],"光伏电池与组件、磁材"),
("chint","正泰电器","Zhejiang Chint Electrics","CN","SSE","601877",["module","utility"],"光伏组件、户用光伏、电站"),
("hoymiles","禾迈股份","Hoymiles","CN","SSE STAR","688032",["inverter"],"微型逆变器"),
("apsystems","昱能科技","APsystems","CN","SSE STAR","688348",["inverter"],"微型逆变器"),
("sineng","上能电气","Sineng Electric","CN","SZSE","300827",["inverter","storage"],"集中式逆变器、储能 PCS"),
("arctech","中信博","Arctech Solar","CN","SSE STAR","688408",["tracker"],"跟踪支架"),
("maxeon","迈升","Maxeon Solar Technologies","SG","Nasdaq","MAXN",["module"],"光伏组件"),
("brookfieldre","布鲁克菲尔德可再生能源","Brookfield Renewable Partners","CA","NYSE/TSX","BEP",["utility"],"可再生能源电站"),
("chinapower","中国电力","China Power International Development","CN","HKEX","2380",["utility"],"清洁能源电站"),
("boe","京东方","BOE Technology","CN","SZSE","000725",["display"],"LCD/OLED 面板"),
("lgd","LG 显示","LG Display","KR","KRX/NYSE","034220 / LPL",["display"],"OLED/LCD 面板"),
("tcltech","TCL 科技","TCL Technology","CN","SZSE","000100",["display","ingot"],"华星光电面板、中环硅片"),
("sony","索尼集团","Sony Group","JP","TSE/NYSE","6758 / SONY",["camera","phone"],"CMOS 图像传感器、消费电子"),
("sunny","舜宇光学","Sunny Optical Technology","CN","HKEX","2382",["camera"],"手机镜头、摄像模组"),
("murata","村田制作所","Murata Manufacturing","JP","TSE","6981",["passive"],"MLCC、射频模块"),
("tdk","TDK","TDK Corporation","JP","TSE","6762",["passive"],"被动元件、消费电池（ATL）"),
("cctc","三环集团","CCTC","CN","SZSE","300408",["passive"],"MLCC、陶瓷元件"),
("luxshare","立讯精密","Luxshare Precision","CN","SZSE","002475",["precision","assembly"],"连接器、声学、整机组装"),
("lens","蓝思科技","Lens Technology","CN","SZSE","300433",["precision"],"玻璃盖板、结构件"),
("goertek","歌尔股份","Goertek","CN","SZSE","002241",["precision","assembly"],"声学器件、VR 整机"),
("lingyi","领益智造","Lingyi iTech","CN","SZSE","002600",["precision"],"精密功能件、结构件"),
("pegatron","和硕","Pegatron","TW","TWSE","4938",["assembly"],"电子代工"),
("quanta","广达电脑","Quanta Computer","TW","TWSE","2382",["assembly","ems"],"笔电代工、AI 服务器"),
("wistron","纬创资通","Wistron","TW","TWSE","3231",["assembly","ems"],"电子代工、服务器"),
("bydelec","比亚迪电子","BYD Electronic","CN","HKEX","0285",["assembly"],"手机零部件与组装"),
("jabil","捷普","Jabil","US","NYSE","JBL",["assembly"],"电子制造服务"),
("flex","伟创力","Flex","US","Nasdaq","FLEX",["assembly"],"电子制造服务"),
("lenovo","联想集团","Lenovo Group","CN","HKEX","0992",["phone"],"PC、服务器、手机"),
("hp","惠普","HP Inc.","US","NYSE","HPQ",["phone"],"PC、打印机"),
("transsion","传音控股","Transsion Holdings","CN","SSE STAR","688036",["phone"],"新兴市场手机"),
("bestbuy","百思买","Best Buy","US","NYSE","BBY",["retail"],"消费电子零售"),
("jd","京东集团","JD.com","CN","Nasdaq/HKEX","JD / 9618",["retail"],"电商零售"),
]
# 追加跨产业归属
_extra={"apple":["phone","cechip"],"samsung":["phone","display"],"xiaomi":["phone"],"qualcomm":["cechip"],"mediatek":["cechip"],"foxconn":["assembly"],"dell":["phone"],"alphabet":["phone"],"huawei":["phone"]}
C=[(c[0],c[1],c[2],c[3],c[4],c[5],c[6]+_extra.get(c[0],[]),c[7]) for c in C]
# 候选关系（均需 refresh.py 在公开文本中找到证据才标「已引用」，否则「待核实」）
R += [(a,b,t,n,'') for a,b,t,n in [
 ("foxconn","apple","供货","iPhone 组装"),("pegatron","apple","供货","iPhone 组装"),("luxshare","apple","供货","AirPods/iPhone 组装"),("quanta","apple","供货","MacBook 代工"),
 ("sony","apple","供货","图像传感器"),("lgd","apple","供货","OLED 面板"),("boe","apple","供货","OLED 面板"),("murata","apple","供货","被动元件"),("lens","apple","供货","玻璃盖板"),
 ("qualcomm","samsung","供货","骁龙芯片"),("qualcomm","xiaomi","供货","骁龙芯片"),("samsung","apple","供货","OLED/存储"),("tsmc","broadcom","供货","代工"),("tsmc","marvell","供货","代工"),
 ("catl","nio","供货","动力电池"),("catl","vw","供货","动力电池"),("catl","mercedes","供货","动力电池"),("catl","ford","授权","LFP 技术授权"),("lges","hyundai","合资","电池合资"),
 ("samsungsdi","stellantis","合资","StarPlus Energy"),("panasonic","toyota","合资","Prime Planet Energy & Solutions"),("pilbara","ganfeng","供货","锂辉石包销"),
 ("nvidia","byd","供货","DRIVE 平台"),("robosense","xpeng","供货","激光雷达"),("hesai","byd","供货","激光雷达"),("mobileye","geely","供货","辅助驾驶芯片"),
 ("intel","tsmc","供货","代工外包（Intel 为客户）"),("amkor","apple","供货","封测"),("ase","apple","供货","封测"),("tsmc","asml","供货","—")][:-1]]
R=[(a,b,t,n,c) if len(r)==5 else r for r in R for (a,b,t,n,c) in [r]]
R=[(b,a,t,n,c) if (a,b)==("intel","tsmc") else (a,b,t,n,c) for a,b,t,n,c in R]

# ===== v0.8: 储能 + 医药全产业 =====
IND["ess"]=("储能","Energy Storage")
IND["pharma"]=("医药","Pharmaceuticals")
SEG += [
 ("ess","储能材料","上游","ess_mat","电芯材料（正负极/电解液/隔膜）"),
 ("ess","储能电芯","中游","ess_cell","储能电芯"),
 ("ess","功率与控制","中游","ess_pcs","PCS / 储能逆变器"),
 ("ess","功率与控制","中游","ess_bms","BMS / EMS"),
 ("ess","系统集成","中游","ess_system","储能系统集成"),
 ("ess","电站与应用","下游","ess_project","储能电站/电网侧应用"),
 ("pharma","原料与器械","上游","ph_api","原料药 / API"),
 ("pharma","原料与器械","上游","ph_device","医疗器械与诊断"),
 ("pharma","研发生产","中游","ph_cxo","CXO / CDMO"),
 ("pharma","创新与仿制","中游","ph_innovator","创新药"),
 ("pharma","创新与仿制","中游","ph_biotech","生物技术 / 疫苗"),
 ("pharma","创新与仿制","中游","ph_generic","仿制药 / 制剂"),
 ("pharma","流通","下游","ph_distrib","医药流通与零售"),
]
LINKS["ess"]=[("ess_mat","ess_cell"),("ess_cell","ess_system"),("ess_pcs","ess_system"),("ess_bms","ess_system"),("ess_system","ess_project")]
LINKS["pharma"]=[("ph_api","ph_innovator"),("ph_api","ph_generic"),("ph_api","ph_biotech"),("ph_cxo","ph_innovator"),("ph_cxo","ph_biotech"),("ph_device","ph_distrib"),("ph_innovator","ph_distrib"),("ph_generic","ph_distrib"),("ph_biotech","ph_distrib")]
# 既有公司挂到储能环节
_ess_extra={
  "catl":["ess_cell"],"bye":[],"byd":["ess_cell"],"eve":["ess_cell"],"sunwoda":["ess_cell"],
  "lges":["ess_cell"],"samsungsdi":["ess_cell"],"panasonic":["ess_cell"],
  "sungrow":["ess_pcs","ess_system"],"sineng":["ess_pcs"],"fluence":["ess_system","ess_project"],
  "enphase":["ess_pcs"],"tesla":["ess_system","ess_project"],"apsystems":["ess_pcs"],
  "huayou":["ess_mat"],"dynanonic":["ess_mat"],"senior":["ess_mat"],"capchem":["ess_mat"],"putailai":["ess_mat"],
}
C=[(c[0],c[1],c[2],c[3],c[4],c[5],c[6]+_ess_extra.get(c[0],[]),c[7]) for c in C]
C += [
# 储能新增
("contemporary","—","—","CN","—","—",["ess_cell"],"—"),  # placeholder skip
("powin","Powin","Powin","US","Private","—",["ess_system"],"储能系统集成"),
("steminc","Stem","Stem Inc.","US","NYSE","STEM",["ess_bms","ess_project"],"储能软件与资产"),
("eosenergy","Eos Energy","Eos Energy Enterprises","US","Nasdaq","EOSE",["ess_cell"],"锌基储能电芯"),
("fluencerenew","—","—","US","—","—",[],"—"),
("crrc","时代电气/中车","CRRC Times Electric","CN","HKEX/SSE","3898 / 688187",["ess_pcs"],"储能变流与轨交电驱"),
("hyperstrong","海博思创","Beijing Hyperstrong","CN","SSE STAR","688411",["ess_system"],"储能系统集成"),
("clenergy","—","—","CN","—","—",[],"—"),
# 医药
("pfizer","辉瑞","Pfizer","US","NYSE","PFE",["ph_innovator","ph_biotech"],"创新药、疫苗"),
("jnj","强生","Johnson & Johnson","US","NYSE","JNJ",["ph_innovator","ph_device"],"创新药、医疗器械"),
("lilly","礼来","Eli Lilly","US","NYSE","LLY",["ph_innovator"],"糖尿病/减重/神经科学创新药"),
("novo","诺和诺德","Novo Nordisk","DK","NYSE/CPH","NVO",["ph_innovator","ph_biotech"],"糖尿病与减重生物药"),
("merck","默沙东","Merck & Co.","US","NYSE","MRK",["ph_innovator","ph_biotech"],"Keytruda 等肿瘤与疫苗"),
("abbvie","艾伯维","AbbVie","US","NYSE","ABBV",["ph_innovator"],"免疫与神经创新药"),
("roche","罗氏","Roche Holding","CH","SIX","ROG.SW",["ph_innovator","ph_device"],"肿瘤创新药、诊断"),
("novartis","诺华","Novartis","CH","NYSE/SIX","NVS",["ph_innovator"],"创新药"),
("astrazeneca","阿斯利康","AstraZeneca","GB","Nasdaq","AZN",["ph_innovator"],"肿瘤、呼吸、心血管创新药"),
("bms","百时美施贵宝","Bristol-Myers Squibb","US","NYSE","BMY",["ph_innovator"],"肿瘤与心血管创新药"),
("amgen","安进","Amgen","US","Nasdaq","AMGN",["ph_biotech"],"生物技术药"),
("gilead","吉利德","Gilead Sciences","US","Nasdaq","GILD",["ph_biotech","ph_innovator"],"抗病毒与肿瘤"),
("moderna","莫德纳","Moderna","US","Nasdaq","MRNA",["ph_biotech"],"mRNA 疫苗与疗法"),
("regeneron","再生元","Regeneron","US","Nasdaq","REGN",["ph_biotech"],"抗体药"),
("thermofisher","赛默飞","Thermo Fisher Scientific","US","NYSE","TMO",["ph_device","ph_cxo"],"生命科学工具、CDMO"),
("danaher","丹纳赫","Danaher","US","NYSE","DHR",["ph_device"],"生命科学与诊断"),
("wuxibiologics","药明生物","WuXi Biologics","CN","HKEX","2269",["ph_cxo"],"生物药 CDMO"),
("wuxiapptec","药明康德","WuXi AppTec","CN","SSE/HKEX","603259 / 2359",["ph_cxo"],"小分子/细胞基因 CXO"),
("catalent","Catalent","Catalent","US","NYSE","CTLT",["ph_cxo"],"制剂 CDMO"),
("lonza","龙沙","Lonza Group","CH","SIX","LONN.SW",["ph_cxo"],"CDMO"),
("cspc","石药集团","CSPC Pharmaceutical","CN","HKEX","1093",["ph_innovator","ph_generic"],"创新药与普药"),
("hansoh","翰森制药","Hansoh Pharmaceutical","CN","HKEX","3692",["ph_innovator"],"创新药"),
("innovent","信达生物","Innovent Biologics","CN","HKEX","1801",["ph_biotech"],"抗体生物药"),
("beigene","百济神州","BeOne Medicines (BeiGene)","CN","Nasdaq/HKEX","ONC / 6160",["ph_innovator","ph_biotech"],"肿瘤创新药"),
("sinopharm","国药控股","Sinopharm Group","CN","HKEX","1099",["ph_distrib"],"医药流通"),
]
# drop placeholders
C=[c for c in C if c[2]!="—" and c[5]!="—"]
R += [(a,b,t,n,'') for a,b,t,n in [
 ("catl","fluence","供货","储能电芯"),("catl","sungrow","供货","储能电芯"),("lges","fluence","供货","储能电芯"),
 ("sungrow","ess_project","供货","—"),  # bad - skip
 ("thermofisher","pfizer","供货","生命科学工具/服务"),("wuxiapptec","pfizer","供货","CXO 服务"),
 ("wuxibiologics","novo","供货","生物药 CDMO"),("lonza","moderna","供货","CDMO"),
]]
R=[r for r in R if r[1]!='ess_project']
