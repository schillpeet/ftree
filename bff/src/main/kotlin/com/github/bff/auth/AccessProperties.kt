package com.github.bff.auth

import org.springframework.boot.context.properties.ConfigurationProperties

// APP_ACCESS_FILE: path of the access file (see AccessFile.kt); unset, app.roles applies.
@ConfigurationProperties("app.access")
data class AccessProperties(val file: String? = null)
