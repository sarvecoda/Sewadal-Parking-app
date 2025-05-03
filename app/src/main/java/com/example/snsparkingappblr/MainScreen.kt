package com.example.snsparkingappblr

import android.app.Dialog
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.snsparkingappblr.databinding.*
import com.google.firebase.FirebaseApp
import kotlinx.coroutines.launch

/**
 * Shows today's vehicle list, lets you add / edit / delete entries,
 * and search the master list.
 */
class MainScreen : AppCompatActivity(),
    FirestoreVehicleAdapter.OnItemClickListener,
    VehicleAdapter.OnItemClickListener {

    /* -------------------------------------------------------------------------------- */
    /*                                view‑binding / vm                                */
    /* -------------------------------------------------------------------------------- */

    private lateinit var binding: ActivityMainScreenBinding
    private val vm: MainViewModel by viewModels()

    /* -------------------------------------------------------------------------------- */
    /*                                 Recycler adapters                                */
    /* -------------------------------------------------------------------------------- */

    private val todayAdapter  = VehicleAdapter(mutableListOf(), this)
    private val searchAdapter = FirestoreVehicleAdapter(mutableListOf(), this)

    private lateinit var searchDialog: Dialog     // keep a ref so we can dismiss

    /* -------------------------------------------------------------------------------- */

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // draw behind the status bar
        window.apply {
            decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            statusBarColor = Color.TRANSPARENT
        }

        FirebaseApp.initializeApp(this)
        binding = ActivityMainScreenBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupRecycler()
        setupClicks()
        observeViewModel()
    }

    /* -------------------------------------------------------------------------------- */
    /*                                   setup blocks                                   */
    /* -------------------------------------------------------------------------------- */

    private fun setupRecycler() = binding.finalRecyclerList.run {
        layoutManager = LinearLayoutManager(this@MainScreen)
        adapter       = todayAdapter
    }

    private fun setupClicks() {
        binding.floatAddUnAddedVehicles.setOnClickListener { showAddDialog() }
        binding.addVehicleBtn.setOnClickListener           { showSearchDialog() }
        binding.DELETEALLBUTTONS.setOnClickListener        { confirmDeleteAll() }
    }

    private fun observeViewModel() {
        lifecycleScope.launchWhenStarted {
            vm.today.collect { list -> todayAdapter.update(list.map { it.second }) }
        }
    }

    /* -------------------------------------------------------------------------------- */
    /*                              dialogs & UI helpers                                */
    /* -------------------------------------------------------------------------------- */

    /** Dialog where user types a brand‑new vehicle. */
    private fun showAddDialog() {
        val dBinding = UnaddedVehiclesDialogBinding.inflate(layoutInflater)
        Dialog(this).apply {
            setContentView(dBinding.root)
            matchParentWidth()

            dBinding.addUnaddedRecord.setOnClickListener {
                val v = VehicleData(
                    entry1 = dBinding.unaddedName.text.toString(),
                    entry2 = dBinding.unaddedVehicleNo.text.toString(),
                    entry3 = dBinding.unaddedMobileNo.text.toString(),
                    entry4 = dBinding.unaddedModelNo.text.toString()
                )
                vm.add(v)
                dismiss()
            }
        }.show()
    }

    /** Dialog that shows the entire Firestore list with search. */
    private fun showSearchDialog() {
        searchDialog = Dialog(this)
        val sBinding = FullListVehicleDialogBinding.inflate(layoutInflater)
        searchDialog.setContentView(sBinding.root)
        searchDialog.matchParentWidth()
        searchDialog.window?.setBackgroundDrawable(
            ContextCompat.getDrawable(this, R.drawable.rounded_dialog_background)
        )

        sBinding.fullRecyclerList.apply {
            layoutManager = LinearLayoutManager(this@MainScreen)
            adapter       = searchAdapter
        }

        // push current master list
        searchAdapter.update(vm.all.value.map { it.second })

        sBinding.searchVehiclesList.setOnQueryTextListener(object :
            androidx.appcompat.widget.SearchView.OnQueryTextListener {
            override fun onQueryTextSubmit(query: String?) = false
            override fun onQueryTextChange(newText: String?): Boolean {
                searchAdapter.filter(newText ?: "")
                return true
            }
        })

        sBinding.cancelRecyclerList.setOnClickListener { searchDialog.dismiss() }
        searchDialog.show()
    }

    /** Two‑button alert to wipe today's list. */
    private fun confirmDeleteAll() {
        AlertDialog.Builder(this)
            .setTitle("Delete today’s list?")
            .setMessage("This cannot be undone.")
            .setPositiveButton("Delete") { _, _ -> vm.deleteAllToday() }
            .setNegativeButton("Cancel", null)
            .show()
    }

    /* -------------------------------------------------------------------------------- */
    /*                      Adapter callback implementations (today list)               */
    /* -------------------------------------------------------------------------------- */

    /** Called when user taps a row in the *search* list. */
    override fun onItemClick(entry: VehicleData) {
        // prevent duplicates
        val exists = vm.today.value.any { it.second.entry2 == entry.entry2 }
        if (exists) {
            Toast.makeText(this, "This vehicle is already in the list", Toast.LENGTH_SHORT).show()
            return
        }

        FinalVehicleAddingDialogBinding.inflate(layoutInflater).let { fBinding ->
            Dialog(this).apply {
                setContentView(fBinding.root)
                matchParentWidth()

                fBinding.aboutToBeAddedValues.text =
                    "${entry.entry1}, ${entry.entry2}, ${entry.entry4}"

                fBinding.finalVehicleAddingYesbtn.setOnClickListener {
                    vm.add(entry)
                    dismiss()
                    searchDialog.dismiss()
                }
                fBinding.finalVehicleAddingNobtn.setOnClickListener { dismiss() }
            }.show()
        }
    }

    /** Pencil icon inside today list. */
    override fun onPenclilImageClick(entry: VehicleData) {
        val docId = vm.today.value.find { it.second == entry }?.first ?: return

        EditDialogVehicleBinding.inflate(layoutInflater).let { eBinding ->
            Dialog(this).apply {
                setContentView(eBinding.root)
                matchParentWidth()

                eBinding.editName.setText(entry.entry1)
                eBinding.editVehicleNo.setText(entry.entry2)
                eBinding.editMobileNo.setText(entry.entry3)
                eBinding.editModelNo.setText(entry.entry4)

                eBinding.editRecord.setOnClickListener {
                    val updated = entry.copy(
                        entry1 = eBinding.editName.text.toString(),
                        entry2 = eBinding.editVehicleNo.text.toString(),
                        entry3 = eBinding.editMobileNo.text.toString(),
                        entry4 = eBinding.editModelNo.text.toString()
                    )
                    lifecycleScope.launch {
                        // simplest: delete old then add new
                        VehicleRepository.delete(docId, today = true)
                        VehicleRepository.add(updated, today = true)
                    }
                    dismiss()
                }
            }.show()
        }
    }

    /** Trash‑can icon inside today list. */
    override fun deleteButtonOnClick(vehicleData: VehicleData) {
        val docId = vm.today.value.find { it.second == vehicleData }?.first ?: return
        AlertDialog.Builder(this)
            .setTitle("Delete Record")
            .setMessage("Remove this entry?")
            .setPositiveButton("Yes") { _, _ -> vm.deleteTodayDoc(docId) }
            .setNegativeButton("No", null)
            .show()
    }

    /** Phone‑number click inside today list. */
    override fun onCallButtonClick(context: android.content.Context, vehicleData: VehicleData) {
        AlertDialog.Builder(context)
            .setTitle("Confirm Call")
            .setMessage("Call ${vehicleData.entry1} on ${vehicleData.entry3}?")
            .setPositiveButton("Yes") { _, _ ->
                startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${vehicleData.entry3}")))
            }
            .setNegativeButton("No", null)
            .show()
    }
}
