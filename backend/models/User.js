const bcrypt = require("bcryptjs")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please Enter Your Name"],
        maxLength: [30, "Name cannot exceed 30 characters"],
        minLength: [3, "Name should have more than 4 characters"],
      },
       avatar: {
        public_id:String,
        url: String,
      },
      email: {
        type: String,
        required: [true, "Please Enter Your Email"],
        unique: [true,"Email already exists"]
      },
      password: {
        type: String,
        required: [true, "Please Enter Your Password"],
        minLength: [8, "Password should be greater than 8 characters"],
        select: false,
      },
      posts:[
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post"
          }
      ],
      followers:[
          {          
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
          }
      ],
      following:[
          {          
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
          }
      ],
      resetPasswordToken: String,
      resetPasswordExpire: Date,

})
//Hash Password
userSchema.pre("save", async function (next) {

  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10)
  }
 next()
})

//Compare Password
userSchema.methods.matchPassword = async function (password){
 return await bcrypt.compare(password, this.password)
}

// JWT TOKEN
userSchema.methods.generateToken = function (){
   return jwt.sign({id: this._id}, process.env.JWT_SECRET)
}

//ResetPassword Token
userSchema.methods.getResetPasswordToken = function(){

  const resetToken = crypto.randomBytes(20).toString("hex")

  this.resetPasswordToken = crypto
  .createHash("sha256")
  .update(resetToken)
  .digest("hex")

  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000

  return resetToken

}


module.exports = mongoose.model("User", userSchema)