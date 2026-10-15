# 陪伴核心 2.7.2

修复 UTC 容器中“今日”日期偏移：插件默认采用 Asia/Shanghai，可通过 QWENPAW_COMPANION_TIMEZONE 指定其他 IANA 时区；不修改宿主时区。健康接口新增 timezone 和 today，时间戳带时区偏移。已有日期和时间戳保持原样。

非法梦境日期返回 400，有效但无记录的日期仍为 404。已知数据与梦境文件权限收紧至 0600，写入采用私密临时文件原子替换，保留数据内容。

备份完整实际数据目录后手动覆盖安装 companion-core-2.7.2.zip，重新加载插件并刷新页面；独立安装的技能模板也请同步更新。可用 /health 核对 version=2.7.2、timezone=Asia/Shanghai、today 是否正确。不会创建测试数据、清除记录或启动备份服务。
