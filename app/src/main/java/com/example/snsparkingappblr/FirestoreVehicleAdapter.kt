package com.example.snsparkingappblr

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.snsparkingappblr.databinding.VehicleFormatLooklikeBinding

class FirestoreVehicleAdapter(private var firestorevehicleDataList: ArrayList<VehicleData>, private val listener: OnItemClickListener) : RecyclerView.Adapter<FirestoreVehicleAdapter.MyViewHolder>() {

    class MyViewHolder(private val binding: VehicleFormatLooklikeBinding) : RecyclerView.ViewHolder(binding.root){
        val vehicleMain = binding.vehicleMain
        fun bind(vehicleData: VehicleData, listener: OnItemClickListener){
            binding.nameLookLike.text = vehicleData.entry1
            binding.vehNoLookLike.text = vehicleData.entry2
            binding.mobileNoLookLike.text = vehicleData.entry3
            binding.modelNameLookLike.text = vehicleData.entry4

            //add click listeners for individual components
            binding.ivEdit.setOnClickListener {
                listener.onPenclilImageClick(vehicleData)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MyViewHolder {
        val binding = VehicleFormatLooklikeBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return MyViewHolder(binding)
    }

    override fun onBindViewHolder(holder: MyViewHolder, position: Int) {
        val currentRow = filteredVehicles[position]
        holder.bind(currentRow, listener)

        // Change the background color based on the position
        if (position % 2 == 0) {
            holder.vehicleMain.setBackgroundColor(ContextCompat.getColor(holder.itemView.context, R.color.khakhi))
        } else {
            holder.vehicleMain.setBackgroundColor(ContextCompat.getColor(holder.itemView.context, R.color.skyblue))
        }

        // Make the entire view clickable
        holder.itemView.setOnClickListener {
            listener.onItemClick(currentRow)
        }
    }

    override fun getItemCount(): Int {
        return filteredVehicles.size
    }

    interface OnItemClickListener {
        fun onItemClick(vehicleData: VehicleData)
        fun onPenclilImageClick(vehicleData: VehicleData)
    }

    private var filteredVehicles: List<VehicleData> = firestorevehicleDataList

    fun filter(query: String) {
        filteredVehicles = if (query.isEmpty()) {
            firestorevehicleDataList
        } else {
            firestorevehicleDataList.filter { vehicle ->
                vehicle.entry1.contains(query, ignoreCase = true) || vehicle.entry2.contains(query, ignoreCase = true)
            }
        }
        notifyDataSetChanged()
    }
}
