package com.github.bff.access

import com.github.bff.generated.model.TreeRole
import java.util.Locale

// The invitation the inviter copies and sends themselves; the BFF sends no email. Cloudflare Access signs people in
// with a one-time code it mails to them, so the text says that no password is needed.
fun invitationText(acceptLanguage: String?, inviter: String, tree: String, role: TreeRole, link: String, email: String): String =
    when (languageOf(acceptLanguage)) {
        "de" -> """
            |Hallo!
            |
            |$inviter hat dich als ${GERMAN_ROLES.getValue(role)} zum Stammbaum „$tree“ eingeladen.
            |
            |Öffne $link und melde dich mit deiner E-Mail-Adresse $email an. Ein Passwort brauchst du nicht: Du bekommst einen einmaligen Code per E-Mail, mit dem du dich anmeldest.
        """.trimMargin()
        else -> """
            |Hello!
            |
            |$inviter has invited you to the family tree “$tree” as ${ENGLISH_ROLES.getValue(role)}.
            |
            |Open $link and sign in with your email address $email. You need no password: you will get a one-time code by email to sign in with.
        """.trimMargin()
    }

// The invitation to an empty setup: the person makes their own tree after signing in and becomes its owner; the role
// named here is the one they have in a tree they are invited to later.
fun setupInvitationText(acceptLanguage: String?, inviter: String, link: String, email: String, role: TreeRole): String =
    when (languageOf(acceptLanguage)) {
        "de" -> """
            |Hallo!
            |
            |$inviter hat dich eingeladen, deinen eigenen Stammbaum anzulegen. Sobald du einen Baum neu anlegst, bist du dessen Eigentümer. Falls du zu einem bestimmten Baum eingeladen wirst, hast du dort die Rolle ${GERMAN_ROLES.getValue(role)}.
            |
            |Öffne $link und melde dich mit deiner E-Mail-Adresse $email an. Ein Passwort brauchst du nicht: Du bekommst einen einmaligen Code per E-Mail, mit dem du dich anmeldest.
        """.trimMargin()
        else -> """
            |Hello!
            |
            |$inviter has invited you to set up your own family tree. Once you create a tree, you are its owner. If you are invited to a particular tree, your role there is ${ENGLISH_ROLE_NAMES.getValue(role)}.
            |
            |Open $link and sign in with your email address $email. You need no password: you will get a one-time code by email to sign in with.
        """.trimMargin()
    }

// The first of German or English that the header asks for, else English.
internal fun languageOf(acceptLanguage: String?): String {
    val ranges = runCatching { Locale.LanguageRange.parse(acceptLanguage.orEmpty().take(200)) }.getOrDefault(emptyList())
    return Locale.lookupTag(ranges, listOf("de", "en"))?.takeIf { it == "de" } ?: "en"
}

private val GERMAN_ROLES = mapOf(TreeRole.OWNER to "Eigentümer", TreeRole.EDITOR to "Bearbeiter", TreeRole.VISITOR to "Gast")
private val ENGLISH_ROLES = mapOf(TreeRole.OWNER to "an owner", TreeRole.EDITOR to "an editor", TreeRole.VISITOR to "a visitor")
private val ENGLISH_ROLE_NAMES = mapOf(TreeRole.OWNER to "owner", TreeRole.EDITOR to "editor", TreeRole.VISITOR to "visitor")
