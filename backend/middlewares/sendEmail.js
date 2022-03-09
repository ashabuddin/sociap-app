const nodemailer = require("nodemailer")

exports.sendMail = async(options) =>{

    var transporter = nodemailer.createTransport({
        host: "smtp.mailtrap.io",
        port: 2525,
        auth: {
          user: "10d55c53f98992",
          pass: "2c6cff983510e0"
        }
    })

    const mailOptions = {
        from: process.env.SMPT_MAIL,
        to:options.email,
        subject:options.subject,
        text:options.message
    }
    await transporter.sendMail(mailOptions)
}