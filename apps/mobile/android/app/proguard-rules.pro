# ============================================
# Logistics ERP - ProGuard Rules
# ============================================

# Keep Capacitor bridge and plugins
-keep class com.getcapacitor.** { *; }
-keep class com.erp.logistics.** { *; }

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor plugin annotations
-keepattributes *Annotation*

# Preserve line numbers for debugging stack traces
-keepattributes SourceFile,LineNumberTable

# Hide original source file name
-renamesourcefileattribute SourceFile

# Keep Gson (if used by plugins)
-keep class com.google.gson.** { *; }
-keepattributes Signature

# Keep Firebase/FCM classes
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Don't warn about missing optional dependencies
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**
-dontwarn org.apache.http.**
-dontwarn android.net.http.**

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelables
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}
