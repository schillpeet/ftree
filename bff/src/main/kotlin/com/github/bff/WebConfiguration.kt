package com.github.bff

import com.github.bff.auth.LoginRecordingInterceptor
import com.github.bff.member.FamilyVisibilityInterceptor
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.CorsRegistry
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class WebConfiguration(
    @Value("\${app.cors.allowed-origins:http://localhost:3000}")
    private val allowedOrigins: String,
    private val familyVisibilityInterceptor: FamilyVisibilityInterceptor,
    private val loginRecordingInterceptor: LoginRecordingInterceptor,
) : WebMvcConfigurer {
    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(loginRecordingInterceptor)
        registry.addInterceptor(familyVisibilityInterceptor)
    }

    override fun addCorsMappings(registry: CorsRegistry) {
        registry.addMapping("/**")
            .allowedOrigins(*parseOrigins(allowedOrigins).toTypedArray())
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("Content-Type")
    }
}

// app.cors.allowed-origins is a comma-separated list; SecurityConfiguration trusts the same origins.
fun parseOrigins(value: String): Set<String> = value.split(',').map(String::trim).filter(String::isNotEmpty).toSet()
