#!/bin/bash

# 配置文件路径
STORAGE_FILE="$HOME/Library/Application Support/Cursor/User/globalStorage/storage.json"
MAIN_JS_FILE="/Applications/Cursor.app/Contents/Resources/app/out/main.js"

# 生成随机 ID
generate_random_id() {
    openssl rand -hex 32
}

# 生成随机 UUID
generate_random_uuid() {
    uuidgen | tr '[:upper:]' '[:lower:]'
}

# 生成新的 IDs
NEW_MACHINE_ID=${1:-$(generate_random_id)}
NEW_MAC_MACHINE_ID=$(generate_random_id)
NEW_DEV_DEVICE_ID=$(generate_random_uuid)

# 创建备份
backup_file() {
    if [ -f "$STORAGE_FILE" ]; then
        cp "$STORAGE_FILE" "${STORAGE_FILE}.backup_$(date +%Y%m%d_%H%M%S)"
        echo "已创建 storage.json 备份文件"
    fi
}

# 确保目录存在
mkdir -p "$(dirname "$STORAGE_FILE")"

# 创建备份
backup_file

# 创建 main.js 备份
cp "$MAIN_JS_FILE" "${MAIN_JS_FILE}.backup_$(date +%Y%m%d_%H%M%S)"
echo "已创建 main.js 备份文件"

# 如果文件不存在，创建新的 JSON
if [ ! -f "$STORAGE_FILE" ]; then
    echo "{}" > "$STORAGE_FILE"
fi

# 更新所有遥测 ID
tmp=$(mktemp)
perl -i -pe 's/"telemetry\.machineId":\s*"[^"]*"/"telemetry.machineId": "'$NEW_MACHINE_ID'"/' "$STORAGE_FILE"
perl -i -pe 's/"telemetry\.macMachineId":\s*"[^"]*"/"telemetry.macMachineId": "'$NEW_MAC_MACHINE_ID'"/' "$STORAGE_FILE"
perl -i -pe 's/"telemetry\.devDeviceId":\s*"[^"]*"/"telemetry.devDeviceId": "'$NEW_DEV_DEVICE_ID'"/' "$STORAGE_FILE"

# 更新 main.js 文件  替换 ioreg 命令为 uuidgen 命令
perl -i -pe 's/ioreg -rd1 -c IOPlatformExpertDevice/UUID=\$(uuidgen | tr '\''[:upper:]'\'' '\''[:lower:]'\'');echo \\"IOPlatformUUID = \\"\$UUID\\";/g' "$MAIN_JS_FILE"

echo "已成功修改 ID"
echo "machineId: $NEW_MACHINE_ID"
echo "macMachineId: $NEW_MAC_MACHINE_ID"
echo "devDeviceId: $NEW_DEV_DEVICE_ID"

# 检查替换是否成功
if grep -F 'darwin:"UUID=$(uuidgen' "$MAIN_JS_FILE" > /dev/null; then
    echo "main.js 文件修改成功"
else
    echo "警告: main.js 文件可能未被正确修改，请检查文件内容"
    echo "你可以从备份文件恢复: ${MAIN_JS_FILE}.backup_*"
fi