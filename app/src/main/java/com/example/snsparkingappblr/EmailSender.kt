import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import java.util.Properties
import javax.mail.*
import javax.mail.internet.InternetAddress
import javax.mail.internet.MimeMessage

object EmailSender {
    fun sendEmail(email: String, subject: String, body: String) {
        GlobalScope.launch(Dispatchers.IO) {
            val properties = Properties().apply {
                put("mail.smtp.host", "smtp.gmail.com")
                put("mail.smtp.port", "587")
                put("mail.smtp.auth", "true")
                put("mail.smtp.starttls.enable", "true")
            }

            val session = Session.getInstance(properties, object : Authenticator() {
                override fun getPasswordAuthentication(): PasswordAuthentication {
                    return PasswordAuthentication("sarveshkum9999@gmail.com", "1Nirankar2@")
                }
            })

            try {
                val message = MimeMessage(session).apply {
                    setFrom(InternetAddress("sarveshkum9999@gmail.com"))
                    addRecipient(Message.RecipientType.TO, InternetAddress(email))
                    setSubject(subject)
                    setText(body)
                }

                Transport.send(message)
            } catch (e: MessagingException) {
                e.printStackTrace()
            }
        }
    }
}
