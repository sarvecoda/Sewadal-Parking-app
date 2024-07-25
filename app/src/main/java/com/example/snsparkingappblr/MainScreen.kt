package com.example.snsparkingappblr

import android.app.AlertDialog
import android.app.Dialog
import android.graphics.Color
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

    private fun addDataToFirestore() {
        // Initialize Firestore
        val db = FirebaseFirestore.getInstance()

        // Your list of data
        val vehicleList= listOf(
            AddingVehicleData("ANUJ CHANDANI JI", "KA 03 NB 3622", "7204563886", ""),
            AddingVehicleData("SUNDEERLAL JI", "KA 52 2705 3", "9008878809", "OMNI (SILVER)"),
            AddingVehicleData("HEMANT JI", "KA 03 NE 0445", "7353356794", "DZIRE (BLUE)"),
            AddingVehicleData("RAHUL JI", "UK 04 AD 0077", "9910080747", ""),
            AddingVehicleData("PANKAJ JI", "KA 53 MB 0182", "8431005096", ""),
            AddingVehicleData("HAPPY JI", "KA 03 MR 5612", "9480917320", ""),
            AddingVehicleData("AMIT SARDANA JI", "KA 01 MG 7118", "8551957000", "ETOS (GOLDEN)"),
            AddingVehicleData("SWINSHEEL JI", "KA 05 NA 1697", "9164625704", ""),
            AddingVehicleData("AMIT KUHIKAR JI", "KA 50 P 8185", "8879007333", "DUSTER (CHOCOLATE)"),
            AddingVehicleData("SONAL JI", "KA 04 MY 0412", "9845617470", ""),
            AddingVehicleData("DEVENDRA JI", "KA 03 MP 7456", "9611049433", ""),
            AddingVehicleData("PRAMOD JI", "DL 3 CCC 4101", "9891466481", "AMAZE (SILVER)"),
            AddingVehicleData("SAURABH JI", "KA 03 NJ 6124", "9911053145", ""),
            AddingVehicleData("RAJKUMAR JI", "KA 01 MM 1140", "9880029857", ""),
            AddingVehicleData("ASHISH JI", "KA 02 MN 1352", "9886104793", ""),
            AddingVehicleData("AVNEESH RATRA JI", "KA 03 NA 2165", "8951268552", "XUV 500 (WHITE)"),
            AddingVehicleData("ANAND JI", "KA 04 MV 3690", "9900000747", "INNOVA (WHITE)"),
            AddingVehicleData("VANSH JI", "KA 51 MD 9487", "7204311991", "VERNA (SILVER)"),
            AddingVehicleData("VISHWASH JI", "KA 04 MN 7347", "6362240835", "THAR (GREEN)"),
            AddingVehicleData("SUNIL KRAPLINI JI", "KA 01 MQ 2650", "9379529736", "HONDA CITY (GOLDEN BROWN)"),
            AddingVehicleData("NARESH JI", "KA 04 MK 9188", "9686854300", "I 20 (SILVER)"),
            AddingVehicleData("BAKSHI RAM JI", "", "9886204963", ""),
            AddingVehicleData("BALJEET JI", "KA 53 MC 6164", "8073635982", "DUSTER (BROWN)"),
            AddingVehicleData("GAURAV PRUTHI JI", "23 BH 0574 E", "9008715341", "XUV 700 (WHITE)"),
            AddingVehicleData("RAJAN PAHUJA JI", "DL 4C AW 6980", "9619014978", "HONDA CITY (BROWN)"),
            AddingVehicleData("RAJU YADAV JI", "KA 03 NE 3724", "9945592909", "MARUTI ERTIGA (RED)"),
            AddingVehicleData("RAVI RANJAN JI", "KA 01 MR 3201", "8095971229", "CELERIO (SILVER)"),
            AddingVehicleData("SANDEEP CHAUDHRY JI", "KA 51 MP 3060", "9739603785", "KIA SELTOS (BLACK)"),
            AddingVehicleData("SATISH DHIMAN JI", "GJ 01 EW 1763", "9964138111", "TATA HARRIER (BLACK)"),
            AddingVehicleData("VIRENDRA KUMAR JI", "KA 01 ME 4952", "9880235707", "I10 (WHITE)"),
            AddingVehicleData("AKASH MISHRA JI", "JH 02 AG 4155", "9740364304", "WAGON R (SILVER)"),
            AddingVehicleData("ABHISHEK SINGH JI", "TN 22 DL 5664", "9860604735", "MARUTI BALENO (LIGHT GREY)"),
            AddingVehicleData("EKNATH JI", "KA 51 MG 334", "9986357337", "I20 (RED)"),
            AddingVehicleData("MANJU NAYAK JI", "JK 14 B 4013", "6360347540", "SANTRO (SILVER)"),
            AddingVehicleData("AKSHAY JI", "TN 10 BA 0015", "9840230693", "FORTUNER (WHITE)"),
            AddingVehicleData("ASHMEET JI", "KA 05 MU 8228", "9513385557", "HONDA CITY (WHITE)"),
            AddingVehicleData("HARISH JI", "KA 02 MJ 5845", "7795827600", "I10 ASTA (SILVER)"),
            AddingVehicleData("DAYAANAND JI", "KA 03 MW 6603", "9740177570", "I20 (RED)"),
            AddingVehicleData("ABHINAV RATHORE JI", "KA 01 MU 1361", "9035926422", "I20 (RED)"),
            AddingVehicleData("SATISH CHABRA JI", "KA 03 MN 5053", "9448009858", "WAGON R (GREY)"),
            AddingVehicleData("SIDDHARTH CHABRA JI", "MH 12 OM 8291", "9830958080", "AMAZE (GREY)"),
            AddingVehicleData("MAYUR JI", "MH 43 BY 6752", "8722029000", "ALCAZAR (WHITE)"),
            AddingVehicleData("YOGESH MAHABUBANI JI", "KA 01 ME 1494", "7204365251", "ALTO (MAROON)"),
            AddingVehicleData("GAUTHAM BAJAJ JI", "KA 01 MK 7599", "9900488733", "CRETA (WHITE)"),
            AddingVehicleData("RAHUL GANDHI JI", "JK 08 G 8577", "9779994717", "I20 (WHITE)"),
            AddingVehicleData("ARJUN BAJAJ JI", "KA 01 MR 2651", "9900488533", "FORTUNER (WHITE)"),
            AddingVehicleData("ASHISH DIXIT JI", "KA 02 ML 1502", "9886904793", "ECO SPORT (SILVER)"),
            AddingVehicleData("DEEP ANAND JI", "KA 03 ND 1455", "9342032856", "BALENO (BLACK)"),
            AddingVehicleData("PRASHANTH JI", "KA 50 P 1363", "9739493434", "INDIGO (SILVER)"),
            AddingVehicleData("LOKESH KHATRI JI", "KA 04 MP 5028", "9886096104", "RITZ (SILVER)"),
            AddingVehicleData("RAHUL THAKUR JI", "KA 04 MR 5583", "7259378545", "ALTO K10 (WHITE)"),
            AddingVehicleData("JEETU JI", "KA 01 MK 1968", "9986987280", "ETOS (BLUE)"),
            AddingVehicleData("MOHIT SOOD JI", "KA 03 NL 8947", "9845293771", "KIA CARENS (WHITE)"),
            AddingVehicleData("NEHRU JI", "KA 02 MR 2921", "7259790300", "MARAZO (SILVER WHITE)"),
            AddingVehicleData("SANJAT GUPTA JI", "MH 48 AC 9718", "9967654159", "HONDA CITY (WHITE)"),
            AddingVehicleData("AYUSH JINDAL JI", "KA 01 MT 0602", "9991188764", "HONDA CITY (BROWN)"),
            AddingVehicleData("NAVDEEP SACHDEVA JI", "KA 01 MS 7181", "9871104750", "XUV 500 (WHITE)"),
            AddingVehicleData("CK KARUN JI", "KA 04 MY 7875", "9844013264", "I10 ASTA (BLUE)"),
            AddingVehicleData("BHUVI SHARMA JI", "KA 51 MM 7892", "9971891188", ""),
            AddingVehicleData("VINOD BANSILAL JI", "KA 05 MX 3004", "9845016616", ""),
            AddingVehicleData("SATPATI JI", "KA 51 MP 2469", "9663711198", ""),
            AddingVehicleData("ANAND JI", "KA 04 MV 7479", "9900000747", ""),
            AddingVehicleData("NAVDISHA JI", "KA 01 MR 6735", "9916626133", ""),
            AddingVehicleData("NITESH JI", "KA 03 NK 5768", "8872323112", "NEXON (GREEN)"),
            AddingVehicleData("DHARMESH JI", "KA 51 MN 3578", "9900596153", "JAZZ (RED)"),
            AddingVehicleData("YOGESH JI", "KA 04 MQ 2955", "9742263014", "SWIFT (SILVER)"),
            AddingVehicleData("A JI", "KA 03 NF 7730", "6360210918", ""),
            AddingVehicleData("ANSHUL JI", "MP 04 CR 3195", "7694081888", ""),
            AddingVehicleData("SUNIL JI", "KA 53 MF 5842", "8095632642", "DUSTER (BROWN)"),
            AddingVehicleData("ASHOK SHARMA JI", "KA 01 MG 1399", "9341924248", "YELLOW"),
            AddingVehicleData("KAILASH JI", "KA 01 AK 2830", "9538040546", "AUTO (GREEN)"),
            AddingVehicleData("SANTOSH JI", "UP 14 BP 2610", "9538500602", "SANTRO (SILVER)"),
            AddingVehicleData("AJEET JI", "KA 50 MB 0312", "9767214098", "ALTROZ (GREEN)"),
            AddingVehicleData("DEEPAK JI", "KA 03 MV 2686", "9036650022", "I20 (WHITE)"),
            AddingVehicleData("MANORAG SAAENA", "RJ 07 CC 8978", "9999728650", "DUSTER (SILVER)"),
            AddingVehicleData("MAHENDAR", "KA 34 DB 9109", "8553469810", "PULSAR"),
            AddingVehicleData("DHEERAJ JI", "KA 01 HN 1847", "8861776047", "HOBDA ACTIVA"),
            AddingVehicleData("CHANDAN JI", "KA 03 NA 7924", "9845420273", ""),
            AddingVehicleData("V S YADAV JI", "KA 03 MX 9961", "9916246100", ""),
            AddingVehicleData("SAURAV JI", "KA 03 NP 8631", "8792604344", ""),
            AddingVehicleData("AVNISH JI", "KA 03 NA 2105", "8951268552", ""),
            AddingVehicleData("SANDEEP JI", "KA 01 MX 7809", "9535875990", "NEXA XL 6 (WHITE)"),
            AddingVehicleData("AMIT JI", "KA 05 MB 8814", "8240889025", ""),
            AddingVehicleData("SHRITIN JI", "KA 53 MF 2917", "", ""),
            AddingVehicleData("AMIT SARDANA JI", "KA 51 MU 1631", "8551957000", "BREZZA (RED)"),
            AddingVehicleData("SURBHI JI", "KA 51 MM 7897", "8971018670", ""),
            AddingVehicleData("VISHAL JI", "PB 70 F 9450", "8283858532", "WAGNOR"),
            AddingVehicleData("MAYUR JI", "MH 43 BX 6725", "8722029000", ""),
            AddingVehicleData("ISHWAR JI", "KA 04 MX 6041", "8660962874", "ECO (GREY)"),
            AddingVehicleData("MANISH JI", "PB 03 BF 0361", "7536871675", ""),
            AddingVehicleData("SANT TYAGI JI", "KA 53 MK 3318", "9591183559", "PUNCH (GREY)"),
            AddingVehicleData("ASHKOE GUPTA DEVANHALLI", "KA 43 N 3340", "9164292398", "ERTIGA (WHITE)"),
            AddingVehicleData("KARTHIK", "KA 51 MS 3179", "8951135398", "GRAND I10 (DARK GREEN)"),
            AddingVehicleData("REV SUNIL RATRA JI,ZI", "KA 04 MD 8216", "8951135398", "INNOVA (GOLD)"),
            AddingVehicleData("ANSHUL JI", "DL 2C AU 9668", "8744002644", "SWIFT, DARK GREY"),
            AddingVehicleData("COL MANHAS", "PB 35 F 4082", "9945131767", "WAGNOR SILVER"),
            AddingVehicleData("MANISH JI", "KA 30 NA 0998", "9844984772", ""),
            AddingVehicleData("AMAN JI", "KA 05 NC 6745", "7000269225", "RENAULT KIGER"),
            AddingVehicleData("PUNEETH JI", "KA 05 MN 1595", "9964539057", "BALENO SILVER"),
            AddingVehicleData("AMIT VISHNANI JI", "MH 10 AN 3202", "9986951693", "SANTRO"),
            AddingVehicleData("KARAN DODEJJA JI", "KA 05 MT 1442", "9611226555", "SWIFT GREAY"),
            AddingVehicleData("GANSHYAM JI", "KA 01 MH 9525", "9900024370", "SWIFT"),
            AddingVehicleData("AMITH WALIYA JI", "KA 50 MB 8814", "8123434946", "GRAND I10 ASTER"),
            AddingVehicleData("RAJESH JI", "KA 03 NM 4064", "9110841031", "TATA NEXON"),
            AddingVehicleData("SUMITH GUPTA JI", "KA 03 NJ 3304", "9620821809", "JEEP COMPASS"),
            AddingVehicleData("GOPAL CHAND JI", "KA 03 NE 3084", "9480068870", "THAR"),
            AddingVehicleData("VIJAY MISHRA", "KA 53 P 6902", "8197404797", "CIVIC HONDA"),
            AddingVehicleData("SANTOSH JI", "KA 01 MY 0487", "9538500602", "KIA GARENCE"),
            AddingVehicleData("ANUPAM JI", "JH 24 G 5377", "8904735945", "KIA SONNET"),
            AddingVehicleData("SATWINDER JI", "KA 05 4764", "9141520327", ""),
            AddingVehicleData("RAM GOPAL JI", "KA 05 Z 0425", "9845961805", ""),
            AddingVehicleData("MANJUNATH JI", "KA 03 NJ 6419", "9686843287", "SWIFT"),
            AddingVehicleData("ROHINI JI", "TS 9255", "9938049718", "I20 WHITE"),
            AddingVehicleData("REESAW SHREEVASTAV", "KA 51 MS 8284", "7011107317", ""),
            AddingVehicleData("MANISH KUMAR", "KA 03 MN 1651", "9606570928", ""),
            AddingVehicleData("ARPITH JI", "UP 78 AX 8050", "8939648836", ""),
            AddingVehicleData("SONAL", "5054", "9845617470", ""),
            AddingVehicleData("AMITH JI", "KA 51 MA 9124", "9845985328", ""),
            AddingVehicleData("PRABHAKAR JI", "KA 05 MU 1110", "9731399669", ""),
            AddingVehicleData("KUSHAL JI", "910", "9538800336", ""),
            AddingVehicleData("M C PANDEY JI", "KA 03 NJ 7171", "7829611794", "S PRESSO (ORANGE)"),
            AddingVehicleData("JEETU JI", "KA 05 MM 6498", "9986987280", "DUSTER (BROWN)"),
            AddingVehicleData("NIRAJ JI", "JK 02 BR 4315", "9682527195", "SWIFT (WHITE)"),
            AddingVehicleData("SONIYA JI", "23 BH 2225CV", "9611613222", "NEXON (BLACK)"),
            AddingVehicleData("VANDANA JI", "KA 53 MB 5282", "7259637117", "ALTO K 10 (RED)"),
            AddingVehicleData("SUDARSHAN SHAH JI", "KA 01 MC 8092", "9845166446", "INNOVA (BLACK)"),
            AddingVehicleData("ROOP JI", "KA 03 MR 2855", "9845020081", "HONDA CITY (WHITE)"),
            AddingVehicleData("RAMESH JI", "KA 04 MW 0305", "9342458606", "SANTRO (SLIVER)"),
            AddingVehicleData("PRINCE JI", "KA 03 ND 3114", "9972054000", "BREZZA (WHITE)"),
            AddingVehicleData("AVNEESH JI", "KA 04 MM 3272", "9916166246", "WAGON R (BROWN)"),
            AddingVehicleData("CP SARDANA JI", "KA 03 MK 4190", "9868246910", "HONDA CITY (RED)"),
            AddingVehicleData("JAI SHANKAR JI", "JH 0100", "9945140500", "I 10 (SILVER)"),
            AddingVehicleData("SANJEEV GANDJI JI", "DL 10 CL 3194", "8826231621", "NEXON (WHITE)"),
            AddingVehicleData("ASHOK KUMAR JI", "KA 03 MX 1756", "9019225069", "WAGON R (RED)"),
            AddingVehicleData("PUNEET JI", "KA 03 NP 4122", "8095323837", "TATA PUNCH (GREY)"),
            AddingVehicleData("SURAJ JI", "KA 02 MT 8628", "8712864763", "VENUE (SILVER)"),
            AddingVehicleData("SONIA JI", "4737", "9141520327", "I 10 (SILVER)"),
            AddingVehicleData("RAVI KANT SHARMA JI", "KA 03 NE 8723", "9886359048", ""),
            AddingVehicleData("SANDEEP NANGIA JI", "DL 2C AW 3275", "9711444888", "FORD FIGO (GREY)"),
            AddingVehicleData("PAVAN JI", "KA 04 AC 2238", "9741409444", "SWIFT DIZ (WHITE)"),
            AddingVehicleData("SANJEEV KUMAR JI", "KA 01 MJ 2667", "9036034217", ""),
            AddingVehicleData("CHANDER PRAKASH JI", "KA 03 MK 4190", "9868246910", ""),
            AddingVehicleData("PAVAN ARORA JI", "KA 03 MS 4407", "8095010055", "RITZS"),
            AddingVehicleData("VISHAL JI", "PB 70 F 9450", "8283828532", ""),
            AddingVehicleData("PRATIK JI", "KA 03 NP 5038", "9262691951", "PUNCH"),
            AddingVehicleData("DHEERAJ JI", "KA 01 ML 1733", "8861776047", "GRAND I 10"),
            AddingVehicleData("RASHMITA JI", "KA 04 MV 3690", "9900992000", "SWIFT"),
            AddingVehicleData("SANYA JI", "KA 51 MF 5019", "9343340270", ""),
            AddingVehicleData("OJASVI JI", "KA 05 NH 6376", "9606508085", "KIA SONET"),
            AddingVehicleData("VINOD JI", "KA 05 NH 0551", "9591757630", "BREZZA (BLACK)"),
            AddingVehicleData("VISHAL JI", "PB 70 F 9405", "8283850535", ""),
            AddingVehicleData("SANJAY JI", "KA 05 NE 8711", "9845767293", ""),
            AddingVehicleData("HIMANSHU JI", "UP 14 CD 2774", "8800367373", ""),
            AddingVehicleData("SUDEER JI", "MH 03 EB 0456", "9619580340", ""),
            AddingVehicleData("VIVEK NANDAN JI", "GJ 06 LS 9658", "9764097711", "XCENT (WHITE)"),
            AddingVehicleData("ABHAY SAGGU JI", "KA 04 NA 8227", "9739096996", "XL 6 (MAROON)"),
            AddingVehicleData("ASHWIN JI", "KA MH 05 5395", "8178530209", "HYUNDAI XCENT"),
            AddingVehicleData("AKASHJEET JI", "KA 04 MZ 7180", "9731481880", "XUV 300"),
            AddingVehicleData("RAVI JI", "KA 53 MK 5240", "7503179779", "NEXON"),
            AddingVehicleData("AVNISH JI", "KA 51 MS 9632", "7406000146", "XUV 300 (BLACK)"),
            AddingVehicleData("ARPIT JI", "KA 02 ME 9876", "8618641362", "WAGON R"),
            AddingVehicleData("PANU RANG JI", "KA 02 AE 7247", "8450002062", "TATA INDICA (SILVER)"),
            AddingVehicleData("SUMIT KUMAR JI", "KA 01 MX 9641", "9988434984", "ALTROZ"),
            AddingVehicleData("ANKITA MEHRA JI", "KA 34 P 3166", "9673011121", "HYUNDAI (RED)"),
            AddingVehicleData("SANJAY NIRANKARI", "KA 51 MU 8847", "8792211863", "TIAGO"),
            AddingVehicleData("AJAY PRASAD", "KA 03 NN 5420", "7892502746", "NEXON (DARK)"),
            AddingVehicleData("AVINASH", "KA 04 MJ 6209", "9019897097", "ALTO K10"),
            AddingVehicleData("VIVEK JI", "KA 04 MY 9540", "7349342024", "HARRIER"),
            AddingVehicleData("SUMIT CHHABRA JI", "KA 01 MW 9844", "9716240551", "TATA PUNCH"),
            AddingVehicleData("SUSHIL KUMAR JI", "KA 01 MW 5993", "8249581494", ""),
            AddingVehicleData("VIKAS SONI JI ", "KA 51 MJ 1419", "8310827415", "SWIFT")

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

