# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /Users/filipvesa/A Vesa's Life/A_Vesa_s_Life/myroom_frontend/node_modules/react-native/ReactAndroid/proguard-rules.pro
# You can visit https://www.guardsquare.com/proguard/manual/usage/
# for a complete reference.

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.unicode.** { *; }
-keepclassmembers class com.facebook.react.bridge.JavaScriptModule { *; }

# React Native Firebase
-keep class io.invertase.firebase.** { *; }
-keep class com.google.firebase.** { *; }

# React Native Google Sign-In
-keep class com.reactnativegooglesignin.** { *; }

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }

# React Native Gesture Handler
-keep class com.swmansion.gesturehandler.** { *; }

# Notifee
-keep class app.notifee.core.NotifeeInitProvider { *; }