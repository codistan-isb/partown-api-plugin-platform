const nodemailer = require('nodemailer');

module.exports.SendEmail = async (data) => {
  console.log("process.env.MAIL_KEY", process.env.MAIL_KEY)
  
  return new Promise((resolve, reject) => {
    const transport = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 465,
      auth: {
          user: "apikey",
          pass: process.env.MAIL_KEY
      }
   })
    transport.sendMail({
        from: data?.from,
        to: data?.to,
        subject: data?.subject,
        html: data?.body
    }, function(error, info){
      if (error) {
        reject(error)
      } else {
        console.log('Email sent: ' + info.response);
        resolve(true)
      }
    })
  })
}