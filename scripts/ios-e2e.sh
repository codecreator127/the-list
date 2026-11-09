#!/usr/bin/env bash
set -euo pipefail

: "${IOS_SIMULATOR_UDID:?Set IOS_SIMULATOR_UDID to a booted iPhone simulator}"

export EXPO_NO_DOTENV=1 EXPO_PUBLIC_DATA_MODE=firebase
export EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-the-list
export EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-the-list.firebaseapp.com
export EXPO_PUBLIC_FIREBASE_API_KEY=demo-key EXPO_PUBLIC_FIREBASE_APP_ID=demo-app
export EXPO_PUBLIC_USE_LOCAL_FIREBASE_EMULATORS=1
export EXPO_PUBLIC_UPLOAD_API_URL=http://127.0.0.1:32181
export EXPO_PUBLIC_GOOGLE_PLACES_API_KEY='' EXPO_PUBLIC_GOOGLE_MAPS_NATIVE_API_KEY=''

logs=test-results/ios
mkdir -p "$logs"
if [[ ${1:-} != test ]]; then
  xcrun simctl bootstatus "$IOS_SIMULATOR_UDID" -b
  if [[ ! -f ios/Podfile ]]; then
    npx expo prebuild --platform ios --no-install
  fi
  (cd ios && pod install)
  RCT_NO_LAUNCH_PACKAGER=1 xcodebuild -workspace ios/TheList.xcworkspace -scheme TheList \
    -configuration Debug -destination "id=$IOS_SIMULATOR_UDID" -derivedDataPath ios/build build \
    > "$logs/xcodebuild.log" 2>&1 || { tail -n 100 "$logs/xcodebuild.log"; exit 1; }
  xcrun simctl install "$IOS_SIMULATOR_UDID" ios/build/Build/Products/Debug-iphonesimulator/TheList.app
  if [[ ${1:-} == build ]]; then
    exit 0
  fi
fi

: "${FIREBASE_AUTH_EMULATOR_HOST:?Run through Firebase emulators:exec}"
: "${FIRESTORE_EMULATOR_HOST:?Run through Firebase emulators:exec}"
xcrun simctl get_app_container "$IOS_SIMULATOR_UDID" com.thelist.app app >/dev/null
node scripts/ios-e2e.mjs serve > "$logs/uploads.log" 2>&1 &
uploads_pid=$!
EXPO_OFFLINE=1 ./node_modules/.bin/expo start --localhost --port 8081 > "$logs/metro.log" 2>&1 &
metro_pid=$!
trap 'kill "$metro_pid" "$uploads_pid" 2>/dev/null || true' EXIT
for url in "$EXPO_PUBLIC_UPLOAD_API_URL/ready" http://127.0.0.1:8081/status; do
  curl --fail --silent --show-error --retry 30 --retry-connrefused --retry-delay 2 --max-time 5 "$url"
done

photo="$(mktemp -d)"
trap 'rm -f "$photo/photo.png"; rmdir "$photo"; kill "$metro_pid" "$uploads_pid" 2>/dev/null || true' EXIT
xcrun simctl io "$IOS_SIMULATOR_UDID" screenshot "$photo/photo.png"
xcrun simctl addmedia "$IOS_SIMULATOR_UDID" "$photo/photo.png"
maestro --device "$IOS_SIMULATOR_UDID" test --debug-output "$logs/maestro" .maestro/ios-review-photo.yml
node scripts/ios-e2e.mjs verify
