package com.example.snsparkingappblr

import android.app.AlertDialog
import android.app.Dialog
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.snsparkingappblr.databinding.ActivityMainScreenBinding
import com.example.snsparkingappblr.databinding.EditDeleteDialogBinding
import com.example.snsparkingappblr.databinding.EditDialogVehicleBinding
import com.example.snsparkingappblr.databinding.FinalVehicleAddingDialogBinding
import com.example.snsparkingappblr.databinding.FullListVehicleDialogBinding
import com.example.snsparkingappblr.databinding.UnaddedVehiclesDialogBinding
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.FirebaseFirestore
import org.w3c.dom.Text

class MainScreen : AppCompatActivity(), FirestoreVehicleAdapter.OnItemClickListener, VehicleAdapter.OnItemClickListener {

    private var binding: ActivityMainScreenBinding? = null
    private val vehicleDataList = ArrayList<VehicleData>()
    private val firestorevehicleDataList = ArrayList<VehicleData>()
    private val db = FirebaseFirestore.getInstance()
    private val firestoreDocumentIdMap = HashMap<VehicleData, String>()
    private val vehicleDocumentIdMap = HashMap<VehicleData, String>()
    private lateinit var fullListVehicleDialog: Dialog
    private var alldataslno:Int = 1
    private var todaydataslno:Int = 1

    // Global Adapter
    private val firestoreAdapter = FirestoreVehicleAdapter(firestorevehicleDataList, this)

    private val vehicleAdapter = VehicleAdapter(vehicleDataList, this)

    override fun onCreate(savedInstanceState: Bundle?) {

        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        window.statusBarColor = Color.TRANSPARENT

        super.onCreate(savedInstanceState)
        binding = ActivityMainScreenBinding.inflate(layoutInflater)
        setContentView(binding?.root)
        FirebaseApp.initializeApp(this)

        //addDataToFirestore()

        // Initialize and set the adapter for finalRecyclerList
        val finalRecyclerList: RecyclerView? = binding?.finalRecyclerList
        finalRecyclerList?.layoutManager = LinearLayoutManager(this)
        finalRecyclerList?.adapter = vehicleAdapter

        // Update the list as soon as the activity is created
        updatedlistofalldata()

        updatedlistoftodaydata()

        binding?.floatAddUnAddedVehicles?.setOnClickListener {
            showAddNewVehicledialog()
        }

        binding?.addVehicleBtn?.setOnClickListener {
            showCollectionofVehicledatadialog()
        }

        // Inside onCreate method after setting up other click listeners
        binding?.DELETEALLBUTTONS?.setOnClickListener {
            // Check if there are any documents in the Firestore collection
            db.collection("your_collection1")
                .get()
                .addOnSuccessListener { documents ->
                    if (documents.isEmpty) {
                        // If there are no documents, show a toast message
                        Toast.makeText(this@MainScreen, "There are no entries to be deleted", Toast.LENGTH_SHORT).show()
                    } else {
                        // Build the AlertDialog
                        val builder = AlertDialog.Builder(this)
                        builder.setTitle("Confirm Deletion")
                        builder.setMessage("Are you sure you want to delete all entries? This action cannot be undone.")

                        // Add the buttons
                        builder.setPositiveButton("Delete") { dialog, which ->
                            // Clear the list of vehicleDataList
                            vehicleDataList.clear()

                            // Notify the adapter about the changes
                            vehicleAdapter.notifyDataSetChanged()

                            // Delete all documents from Firestore collection
                            db.collection("your_collection1")
                                .get()
                                .addOnSuccessListener { documents ->
                                    for (document in documents) {
                                        document.reference.delete()
                                    }
                                    Toast.makeText(this@MainScreen, "All records deleted", Toast.LENGTH_SHORT).show()
                                }
                                .addOnFailureListener { e ->
                                    Toast.makeText(this@MainScreen, "Failed to delete records", Toast.LENGTH_SHORT).show()
                                    Log.e("Firestore", "Error deleting documents", e)
                                }
                        }

                        builder.setNegativeButton("Cancel") { dialog, which ->
                            // Do nothing, just dismiss the dialog
                        }

                        // Create and show the AlertDialog
                        val alertDialog = builder.create()
                        alertDialog.show()
                    }
                }
                .addOnFailureListener { e ->
                    // Show a toast message for failure to retrieve documents
                    Toast.makeText(this@MainScreen, "Failed to retrieve records", Toast.LENGTH_SHORT).show()
                    Log.e("Firestore", "Error retrieving documents", e)
                }
        }


    }

    private fun showAddNewVehicledialog() {
        val dialog = Dialog(this)
        val dialogBinding = UnaddedVehiclesDialogBinding.inflate(layoutInflater)
        dialog.setContentView(dialogBinding.root)

        setdialogwidth(dialog)
        dialog.show()

        dialogBinding.addUnaddedRecord.setOnClickListener {
            val name = dialogBinding.unaddedName.text.toString()
            val vehicle_no = dialogBinding.unaddedVehicleNo.text.toString()
            val mobile_no = dialogBinding.unaddedMobileNo.text.toString()
            val model_no = dialogBinding.unaddedModelNo.text.toString()

            val allnewVehicledata = VehicleData(alldataslno, name, vehicle_no, mobile_no, model_no)

            val todaynewVehicledata = VehicleData(todaydataslno, name, vehicle_no, mobile_no, model_no)

            adddatatoFirestore(allnewVehicledata, "your_collection")

            adddatatoFirestore(todaynewVehicledata, "your_collection1")

            alldataslno += 1
            todaydataslno += 1

            updatedlistofalldata()

            updatedlistoftodaydata()
            dialog.dismiss()
        }
    }



    private fun adddatatoFirestore(newdata: VehicleData, path: String) {
        db.collection(path)
            .add(newdata)
            .addOnSuccessListener { documentReference ->
                Log.d("Firestore", "Document added with ID: ${documentReference.id}")
            }
            .addOnFailureListener { e ->
                Log.e("Firestore", "Error adding document", e)
            }
    }

    private fun setdialogwidth(Newdialog: Dialog) {
        val window = Newdialog.window
        val layoutParams = WindowManager.LayoutParams().apply {
            copyFrom(window?.attributes)
            width = WindowManager.LayoutParams.MATCH_PARENT
        }
        window?.attributes = layoutParams
    }

    private fun showCollectionofVehicledatadialog() {
        fullListVehicleDialog = Dialog(this)
        val dialogBinding = FullListVehicleDialogBinding.inflate(layoutInflater)
        fullListVehicleDialog.setContentView(dialogBinding.root)

        val recyclerView: RecyclerView? = dialogBinding.fullRecyclerList
        recyclerView?.layoutManager = LinearLayoutManager(this)
        recyclerView?.adapter = firestoreAdapter

        // Reset the filter before showing the dialog
        firestoreAdapter.filter("")

        fullListVehicleDialog.window?.setBackgroundDrawable(ContextCompat.getDrawable(this, R.drawable.rounded_dialog_background))

        val layoutParams = WindowManager.LayoutParams()
        layoutParams.copyFrom(fullListVehicleDialog.window?.attributes)
        layoutParams.width = WindowManager.LayoutParams.MATCH_PARENT
        fullListVehicleDialog.window?.attributes = layoutParams

        dialogBinding.searchVehiclesList.setOnQueryTextListener(object : androidx.appcompat.widget.SearchView.OnQueryTextListener {
            override fun onQueryTextSubmit(query: String?): Boolean {
                return false
            }

            override fun onQueryTextChange(newText: String?): Boolean {
                newText?.let {
                    firestoreAdapter.filter(it)
                }
                return true
            }
        })

        fullListVehicleDialog.show()

        dialogBinding.cancelRecyclerList.setOnClickListener {
            fullListVehicleDialog.dismiss()
        }
    }


    private fun updatedlistofalldata() {
        val collectionReference = db.collection("your_collection")
        collectionReference.addSnapshotListener { value, e ->
            if (e != null) {
                // Handle the error
                return@addSnapshotListener
            }

            firestorevehicleDataList.clear()  // Clear the old list
            firestoreDocumentIdMap.clear()

            var maxId = 0

            for (document in value!!) {
                val id = document.getLong("id")?.toInt() ?: 1  // <-- get id from Firestore
                maxId = maxOf(maxId, id)  // Keep track of the highest id
                val entry1 = document.getString("entry1") ?: ""
                val entry2 = document.getString("entry2") ?: ""
                val entry3 = document.getString("entry3") ?: ""
                val entry4 = document.getString("entry4") ?: ""

                val vehicleData = VehicleData(id, entry1, entry2, entry3, entry4)
                alldataslno += 1
                firestorevehicleDataList.add(vehicleData)
                firestoreDocumentIdMap[vehicleData] = document.id
            }

            alldataslno = maxId + 1  // Set the next id to be one more than the max id

            // Sort the list by id
            firestorevehicleDataList.sortBy { it.id }

            firestoreAdapter.notifyDataSetChanged()
        }
    }

    private fun updatedlistoftodaydata(){
        val collectionReference = db.collection("your_collection1")
        collectionReference.addSnapshotListener { value, e ->
            if (e != null) {
                // Handle the error
                return@addSnapshotListener
            }

            vehicleDataList.clear()  // Clear the old list
            vehicleDocumentIdMap.clear()
            var maxId = 0

            for (document in value!!) {
                val id = document.getLong("id")?.toInt() ?: 1  // <-- get id from Firestore
                maxId = maxOf(maxId, id)  // Keep track of the highest id
                val entry1 = document.getString("entry1") ?: ""
                val entry2 = document.getString("entry2") ?: ""
                val entry3 = document.getString("entry3") ?: ""
                val entry4 = document.getString("entry4") ?: ""

                val vehicleData = VehicleData(id, entry1, entry2, entry3, entry4)
                todaydataslno += 1
                vehicleDataList.add(vehicleData)
                vehicleDocumentIdMap[vehicleData] = document.id
            }

            todaydataslno = maxId + 1  // Set the next id to be one more than the max id

            // Sort the list by id
            vehicleDataList.sortBy { it.id }

            vehicleAdapter.notifyDataSetChanged()
        }
    }



    override fun onItemClick(curentvehicleentry: VehicleData) {
        val name = curentvehicleentry.entry1
        val vehicle_no = curentvehicleentry.entry2
        val mobile_no = curentvehicleentry.entry3
        val model_no = curentvehicleentry.entry4

        val addVehicleDialog = Dialog(this)

        var binding2 = FinalVehicleAddingDialogBinding.inflate(layoutInflater)

        addVehicleDialog.setContentView(binding2.root)

        val vehicleExists = vehicleDataList.any { it.entry2 == vehicle_no }
        if (!vehicleExists) {
            binding2.aboutToBeAddedValues.setText("${name}, ${vehicle_no}, ${model_no}")
            addVehicleDialog.show()
        }
        else {
            Toast.makeText(this@MainScreen, "This vehicle is already in the list", Toast.LENGTH_SHORT).show()
            addVehicleDialog.dismiss()
        }


        binding2.finalVehicleAddingYesbtn.setOnClickListener{
            //adding the value of clicked item in recycler view
            val newVehicledata = VehicleData(todaydataslno, name, vehicle_no, mobile_no, model_no)
            adddatatoFirestore(newVehicledata, "your_collection1")

            updatedlistofalldata()

            updatedlistoftodaydata()

            Toast.makeText(this@MainScreen, "${name}'s vehicle has been added to the list", Toast.LENGTH_SHORT).show()
            addVehicleDialog.dismiss()
            fullListVehicleDialog.dismiss()
        }
        binding2.finalVehicleAddingNobtn.setOnClickListener {
            addVehicleDialog.dismiss()
        }
    }

    override fun onPenclilImageClick(curentvehicleentry: VehicleData) {
        val optionsDialog = Dialog(this)
        val optionsBinding = EditDeleteDialogBinding.inflate(layoutInflater)
        optionsDialog.setContentView(optionsBinding.root)

        optionsBinding.btnEdit.setOnClickListener {
            optionsDialog.dismiss()
            showEditDialog(curentvehicleentry)
        }

        optionsBinding.btnDelete.setOnClickListener {
            optionsDialog.dismiss()
            showDeleteWarningDialog(curentvehicleentry)
        }

        setdialogwidth(optionsDialog)
        optionsDialog.show()
    }

    private fun showEditDialog(vehicleData: VehicleData) {
        val name = vehicleData.entry1
        val vehicle_no = vehicleData.entry2
        val mobile_no = vehicleData.entry3
        val model_no = vehicleData.entry4

        val editDialogVehicle = Dialog(this)
        val editBinding = EditDialogVehicleBinding.inflate(layoutInflater)
        editDialogVehicle.setContentView(editBinding.root)

        setdialogwidth(editDialogVehicle)

        editBinding.editName.setText(name)
        editBinding.editVehicleNo.setText(vehicle_no)
        editBinding.editMobileNo.setText(mobile_no)
        editBinding.editModelNo.setText(model_no)

        editDialogVehicle.show()

        editBinding.editRecord.setOnClickListener {
            val updatedname = editBinding.editName.text.toString()
            val updatedvehicle_no = editBinding.editVehicleNo.text.toString()
            val updatedmobile_no = editBinding.editMobileNo.text.toString()
            val updatedmodel_no = editBinding.editModelNo.text.toString()

            val documentId = firestoreDocumentIdMap[vehicleData] ?: return@setOnClickListener
            val updatedVehicleData = hashMapOf(
                "entry1" to updatedname,
                "entry2" to updatedvehicle_no,
                "entry3" to updatedmobile_no,
                "entry4" to updatedmodel_no
            )
            db.collection("your_collection")
                .document(documentId)
                .set(updatedVehicleData)
                .addOnSuccessListener {
                    // Update was successful
                }
                .addOnFailureListener { e ->
                    // Update failed
                }

            val indexToUpdate = firestorevehicleDataList.indexOf(vehicleData)
            if (indexToUpdate != -1) {
                val newVehicleData = VehicleData(vehicleData.id, updatedname, updatedvehicle_no, updatedmobile_no, updatedmodel_no)
                firestorevehicleDataList[indexToUpdate] = newVehicleData
                firestoreAdapter.notifyItemChanged(indexToUpdate)
            }

            Toast.makeText(this@MainScreen, "The data for ${name} is edited", Toast.LENGTH_SHORT).show()
            editDialogVehicle.dismiss()
        }
    }

    private fun showDeleteWarningDialog(vehicleData: VehicleData) {
        val builder = AlertDialog.Builder(this)
        builder.setTitle("Delete Record")
        builder.setMessage("Are you sure you want to delete this entry?")
        builder.setPositiveButton("Yes") { dialog, _ ->
            deleteVehicleData(vehicleData)
            dialog.dismiss()
        }
        builder.setNegativeButton("No") { dialog, _ ->
            dialog.dismiss()
        }
        val alertDialog = builder.create()
        alertDialog.show()
    }


    private fun deleteVehicleData(vehicleData: VehicleData) {
        val documentId = firestoreDocumentIdMap[vehicleData]
        if (documentId != null) {
            db.collection("your_collection")
                .document(documentId)
                .delete()
                .addOnSuccessListener {
                    // Document was successfully deleted
                    firestorevehicleDataList.remove(vehicleData)
                    firestoreAdapter.notifyDataSetChanged()
                    Toast.makeText(this@MainScreen, "Record is deleted", Toast.LENGTH_SHORT).show()
                }
                .addOnFailureListener { e ->
                    // Handle the failure
                }
        }
    }


    override fun deleteButtonOnClick(curentvehicleentry: VehicleData) {
        // Step 1: Find the position of the item in the list
        val position = vehicleDataList.indexOf(curentvehicleentry)
        if (position != -1) {
            val builder = AlertDialog.Builder(this)
            builder.setTitle("Delete Record")
            builder.setIcon(android.R.drawable.ic_dialog_alert)
            builder.setPositiveButton("YES") { dialogInterface, _ ->
                // Step 2: Remove the item from the list
                vehicleDataList.removeAt(position)

                // Step 3: Remove the item from Firestore
                val documentId = vehicleDocumentIdMap[curentvehicleentry]
                if (documentId != null) {
                    db.collection("your_collection1")
                        .document(documentId)
                        .delete()
                        .addOnSuccessListener {
                            // Document was successfully deleted
                            Toast.makeText(this@MainScreen, "Record is deleted", Toast.LENGTH_SHORT).show()
                        }
                        .addOnFailureListener { e ->
                            // Handle the failure
                        }
                }

                // Step 4: Remove from vehicleDocumentIdMap
                vehicleDocumentIdMap.remove(curentvehicleentry)

                // Step 5: Notify the adapter
                vehicleAdapter.notifyItemRemoved(position)

                dialogInterface.dismiss()
            }
            builder.setNegativeButton("NO") { dialogInterface, _ ->
                dialogInterface.dismiss()
            }
            val alertDialog = builder.create()
            alertDialog.show()
        }
    }

    override fun onCallButtonClick(context: Context, vehicleData: VehicleData) {
        val builder = AlertDialog.Builder(context)
        builder.setTitle("Confirm Call")
        builder.setMessage("Are you sure you want to call ${vehicleData.entry1} on ${vehicleData.entry3}?")
        builder.setPositiveButton("Yes") { dialog, _ ->
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${vehicleData.entry3}"))
            context.startActivity(intent)
            dialog.dismiss()
        }
        builder.setNegativeButton("No") { dialog, _ ->
            dialog.dismiss()
        }
        val alertDialog = builder.create()
        alertDialog.show()
    }

    private fun addDataToFirestore() {
        // Initialize Firestore
        val db = FirebaseFirestore.getInstance()

        // Your list of data
        val vehicleList= listOf(
            AddingVehicleData("ANUJ CHANDANI JI", "KA 03 NB 3622", "7204563886", "")

        )

        // Add data to Firestore
        for (vehicle in vehicleList) {
            db.collection("your_collection").add(vehicle)
                .addOnSuccessListener { documentReference ->
                    Log.d("Firestore", "Document added with ID: ${documentReference.id}")
                }
                .addOnFailureListener { e ->
                    Log.e("Firestore", "Error adding document", e)
                }
        }
    }

}

