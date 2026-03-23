package com.varzeastats.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${varzea.mail.from:noreply@varzea.com}")
    private String mailFrom;

    public EmailService(@Autowired(required = false) JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void enviarEmailRedefinicaoSenha(String destinatario, String linkRedefinicao) {
        String assunto = "VARzea Stats — Redefinição de senha";
        String texto =
                "Você solicitou a redefinição de senha. Acesse o link abaixo (válido por 1 hora):\n\n"
                        + linkRedefinicao
                        + "\n\nSe não foi você, ignore este e-mail.";
        if (mailHost != null && !mailHost.isBlank() && mailSender != null) {
            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setTo(destinatario);
                msg.setSubject(assunto);
                msg.setText(texto);
                msg.setFrom(mailFrom);
                mailSender.send(msg);
                log.info("E-mail de redefinição de senha enviado para {}", destinatario);
            } catch (Exception e) {
                log.warn("Falha ao enviar e-mail de redefinição; link registrado no log. Erro: {}", e.getMessage());
                log.info("Link de redefinição para {}: {}", destinatario, linkRedefinicao);
            }
        } else {
            log.info("SMTP não configurado. Link de redefinição para {}: {}", destinatario, linkRedefinicao);
        }
    }
}
