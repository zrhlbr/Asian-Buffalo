# M8 回滚方案

当前全部工作为 **未提交** 改动，基线：

```
git rev-parse HEAD
# 9654d4194d2db801467af34cef1ddc5650fd310f
```

## 丢弃本轮 polish（危险：不可恢复未提交内容）

```powershell
git reset --hard 9654d41
git clean -fd --exclude=node_modules --exclude=.dev.vars
```

## 仅回退客户端布局相关文件

```powershell
git checkout -- client/m5/game/reels.ts client/m5/scene/world.ts client/m5/boot.ts client/m5/styles.css
```

## hosting.json
交付态必须：

```json
{"d1":null,"project_id":"appgprj_6a739f738b9c8191991a9c143b1bc6d9","r2":null}
```
