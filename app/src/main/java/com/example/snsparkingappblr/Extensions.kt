package com.example.snsparkingappblr

import android.app.Dialog
import android.view.WindowManager

fun Dialog.matchParentWidth() {
    window?.setLayout(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.WRAP_CONTENT
    )
}
