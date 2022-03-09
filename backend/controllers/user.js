const Post = require("../models/Post")
const User = require("../models/User")
const { sendMail } = require("../middlewares/sendEmail")
const crypto = require("crypto")
const cloudinary = require("cloudinary")

////Register User
exports.register = async (req, res) => {

    try {
        const { name, email, password, avatar } = req.body

        let user = await User.findOne({ email })

        if (user) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            })
        }
        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars"
        })

        user = await User.create({
            name,
            email,
            password,
            avatar: {
                public_id: myCloud.public_id,
                url: myCloud.secure_url
            },
        })

        const token = await user.generateToken()

        const options = {
            expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            httpOnly: true
        }

        res.status(201).cookie("token", token, options)
            .json({
                success: true,
                user,
                token
            })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//Login User
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body

        const user = await User.findOne({ email })
            .select("+password")
            .populate("posts followers following")

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User does not  exist"
            })
        }

        const isMatch = await user.matchPassword(password)
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Incorrect password"
            })
        }

        const token = await user.generateToken()

        const options = {
            expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            httpOnly: true
        }

        res.status(200).cookie("token", token, options)
            .json({
                success: true,
                user,
                token
            })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//Logout
exports.logout = async (req, res) => {
    try {
        res.cookie("token", null, {
            expires: new Date(Date.now()),
            httpOnly: true,
        })

        res.status(200).json({
            success: true,
            message: "Logged Out",
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//Follow User
exports.followUser = async (req, res) => {
    try {

        const userToFollow = await User.findById(req.params.id)
        const loggedInUser = await User.findById(req.user._id)

        if (!userToFollow) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        if (loggedInUser.following.includes(userToFollow._id)) {

            const indexFollowing = loggedInUser.following.indexOf(userToFollow._id)
            const indexFollowers = userToFollow.followers.indexOf(loggedInUser._id)

            loggedInUser.following.splice(indexFollowing, 1)
            userToFollow.followers.splice(indexFollowers, 1)

            await loggedInUser.save()
            await userToFollow.save()

            res.status(200).json({
                success: true,
                message: "User unFollowed"
            })

        } else {
            loggedInUser.following.push(userToFollow._id)
            userToFollow.followers.push(loggedInUser._id)

            await loggedInUser.save()
            await userToFollow.save()

            res.status(200).json({
                success: true,
                message: "User followed"
            })
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//Update Password
exports.updatePassword = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("+password")

        const { oldPassword, newPassword } = req.body

        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Please provide old and new password"
            })
        }

        const isMatch = await user.matchPassword(oldPassword)

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Incorrect Old Password"
            })
        }

        user.password = newPassword
        await user.save()

        res.status(200).json({
            success: true,
            message: "Password Updated"
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//Update Profile
exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)

        const { name, email, avatar } = req.body

        if (name) {
            user.name = name
        }
        if (email) {
            user.email = email
        }
        if (avatar) {
            await cloudinary.v2.uploader.destroy(user.avatar.public_id)

            const myCloud = await cloudinary.v2.uploader.upload(avatar, {
                folder: "avatars"
            })
            user.avatar.public_id = myCloud.public_id;
            user.avatar.url = myCloud.secure_url;
        }


        await user.save()

        res.status(200).json({
            success: true,
            message: "Profile Updated"
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//Delete Profile
exports.deleteMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
        const posts = user.posts
        const followers = user.followers
        const following = user.following
        const userId = user._id

        //Removing avatar from cludnary
        await cloudinary.v2.uploader.destroy(user.avatar.public_id)

        await user.remove()

        //logout after deleting profile
        res.cookie("token", null, {
            expires: new Date(Date.now()),
            httpOnly: true,
        })

        //deleting all post of user
        for (let i = 0; i < posts.length; i++) {
            const post = await Post.findById(posts[i])
            await cloudinary.v2.uploader.destroy(post.image.public_id)
            await post.remove()
        }

        //Removing User from follower following
        for (let i = 0; i < followers.length; i++) {
            const follower = await User.findById(followers[i]);

            const index = follower.following.indexOf(userId)
            follower.following.splice(index, 1)
            await follower.save()
        }

        //Removing User from following followers
        for (let i = 0; i < following.length; i++) {
            const follows = await User.findById(following[i]);

            const index = follows.followers.indexOf(userId)
            follows.followers.splice(index, 1)
            await follows.save()
        }

        // removing all comments of the user from all posts
        const allPosts = await Post.find();

        for (let i = 0; i < allPosts.length; i++) {
            const post = await Post.findById(allPosts[i]._id);

            for (let j = 0; j < post.comments.length; j++) {
                if (post.comments[j].user === userId) {
                    post.comments.splice(j, 1);
                }
            }
            await post.save();
        }
        // removing all likes of the user from all posts

        for (let i = 0; i < allPosts.length; i++) {
            const post = await Post.findById(allPosts[i]._id);

            for (let j = 0; j < post.likes.length; j++) {
                if (post.likes[j] === userId) {
                    post.likes.splice(j, 1);
                }
            }
            await post.save();
        }

        res.status(200).json({
            success: true,
            message: "Profile deleted"
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//My Profile
exports.myProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate(
            "posts followers following"
        )

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        res.status(200).json({
            success: true,
            user
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//Get User Profile
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).populate(
            "posts followers following"
        )

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.status(200).json({
            success: true,
            user
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({
           name: {$regex: req.query.name, $options: "i" } 
        })

        res.status(200).json({
            success: true,
            users
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//Forgot Password
exports.forgotPassword = async (req, res) => {
    try {

        const user = await User.findOne({ email: req.body.email })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Email not found"
            })
        }

        const resetPasswordToken = user.getResetPasswordToken()

        await user.save()

        const resetUrl = `${req.protocol}://${req.get(
            "host"
        )}/password/reset/${resetPasswordToken}`

        const message = `Your password reset token is :
            - \n\n ${resetUrl} \n\nIf you have not requested this email then, please ignore it.`;

        try {
            await sendMail({
                email: user.email,
                subject: "Social-App Password Recovery",
                message,
            })

            res.status(200).json({
                success: true,
                message: `Email sent to ${user.email} successfully`,
            })

        } catch (error) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;

            await user.save()

            res.status(500).json({
                success: false,
                message: error.message
            })
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//Reset Password
exports.resetPassword = async (req, res) => {
    try {

        // creating token hash
        const resetPasswordToken = crypto
            .createHash("sha256")
            .update(req.params.token)
            .digest("hex")

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        })

        if (!user) {
            return res.status.json(401).json({
                success: false,
                message: "Token is invalid or has expired"
            })
        }

        user.password = req.body.password
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save()

        res.status(200).json({
            success: true,
            message: "Password Updated"
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//Get my posts
exports.getMyPosts = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)

        const posts = []

        for (let i = 0; i < user.posts.length; i++) {
            const post = await Post.findById(user.posts[i]).populate(
                "likes comments.user owner"
            );
            posts.push(post)
        }
        res.status(200).json({
            success: true,
            posts
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//Get users post
exports.getUserPosts = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)

        const posts = []

        for (let i = 0; i < user.posts.length; i++) {
            const post = await Post.findById(user.posts[i]).populate(
                "likes comments.user owner"
            );
            posts.push(post)
        }
        res.status(200).json({
            success: true,
            posts
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}
