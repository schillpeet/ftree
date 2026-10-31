package com.github.bff.admin

import com.github.bff.generated.model.AuditCategory
import org.springframework.context.annotation.Configuration
import org.springframework.format.FormatterRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

// Reads `category` in a query by its API value (`content`), not the enum constant's name; an unknown value answers 400.
@Configuration
class AuditCategoryConverter : WebMvcConfigurer {
    override fun addFormatters(registry: FormatterRegistry) {
        registry.addConverter(String::class.java, AuditCategory::class.java, AuditCategory::fromValue)
    }
}
