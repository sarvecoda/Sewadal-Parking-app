package com.example.snsparkingappblr

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.snsparkingappblr.databinding.VehicleFormatLooklikeBinding

class FirestoreVehicleAdapter(
    private val items: MutableList<VehicleData>,
    private val listener: OnItemClickListener
) : RecyclerView.Adapter<FirestoreVehicleAdapter.MyViewHolder>() {

    /* ---------------------------------  View holder  --------------------------------- */

    class MyViewHolder(private val binding: VehicleFormatLooklikeBinding) :
        RecyclerView.ViewHolder(binding.root) {

        val card = binding.vehicleMain   // for row‑colouring

        fun bind(vehicle: VehicleData, listener: OnItemClickListener) {
            binding.nameLookLike.text   = vehicle.entry1
            binding.vehNoLookLike.text  = vehicle.entry2
            binding.mobileNoLookLike.text = vehicle.entry3
            binding.modelNameLookLike.text = vehicle.entry4

            binding.ivEdit.setOnClickListener {
                listener.onPenclilImageClick(vehicle)
            }
            itemView.setOnClickListener { listener.onItemClick(vehicle) }
        }
    }

    /* -------------------------------- Recycler stuff --------------------------------- */

    private var filtered: List<VehicleData> = items
    private var lastQuery = ""

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MyViewHolder {
        val binding = VehicleFormatLooklikeBinding
            .inflate(LayoutInflater.from(parent.context), parent, false)
        return MyViewHolder(binding)
    }

    override fun getItemCount() = filtered.size

    override fun onBindViewHolder(holder: MyViewHolder, position: Int) {
        val vehicle = filtered[position]
        holder.bind(vehicle, listener)

        // alternate background colours
        val colourRes = if (position % 2 == 0) R.color.khakhi else R.color.skyblue
        holder.card.setBackgroundColor(
            ContextCompat.getColor(holder.itemView.context, colourRes)
        )
    }

    /* ---------------------------------  Helpers  ------------------------------------- */

    /**
     * Replace the adapter’s backing list with a new list (from the ViewModel)
     * and re‑apply whatever filter was active.
     */
    fun update(newList: List<VehicleData>) {
        items.clear()
        items.addAll(newList)
        filter(lastQuery)              // keep the same search text
    }

    /**
     * Filter by vehicle owner or vehicle number (case‑insensitive).
     */
    fun filter(query: String) {
        lastQuery = query
        filtered = if (query.isBlank()) {
            items
        } else {
            items.filter { v ->
                v.entry1.contains(query, ignoreCase = true) ||
                        v.entry2.contains(query, ignoreCase = true)
            }
        }
        notifyDataSetChanged()
    }

    /* ---------------------------------  Contract  ------------------------------------ */

    interface OnItemClickListener {
        fun onItemClick(vehicleData: VehicleData)
        fun onPenclilImageClick(vehicleData: VehicleData)
    }
}
